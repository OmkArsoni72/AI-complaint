import { Request, Response } from 'express';
import { twiml } from 'twilio';
import Complaint from '../models/Complaint';
import Department from '../models/Department';
import crypto from 'crypto';
import { categorizeComplaint, AICategorization } from '../services/aiService';

type SessionState = 'START' | 'AWAITING_DESC' | 'AWAITING_PHOTO' | 'AWAITING_LOCATION';

interface SessionData {
  state: SessionState;
  complaintData: {
    description?: string;
    imageUrl?: string;
    aiAnalysis?: AICategorization;
  };
}

// In-memory session store (sufficient for prototype/hackathon)
const userSessions = new Map<string, SessionData>();

export const handleWhatsAppWebhook = async (req: Request, res: Response): Promise<void> => {
  console.log('--- NEW WHATSAPP MESSAGE RECEIVED ---');
  console.log('Body:', JSON.stringify(req.body, null, 2));

  const twimlResponse = new twiml.MessagingResponse();
  
  try {
    const { From, Body, MediaUrl0, Latitude, Longitude } = req.body;
    
    if (!From) {
      console.log('Error: Missing "From" field');
      res.status(400).send('Missing "From" in payload');
      return;
    }

    console.log(`From: ${From}, State Check...`);
    
    // Get or initialize session state for this user (phone number)
    let session = userSessions.get(From) || { 
      state: 'START', 
      complaintData: {} 
    };

    console.log(`Current Session State: ${session.state}`);

    // If user sends "reset" or "cancel", clear session
    if (Body && Body.trim().toLowerCase() === 'cancel') {
      userSessions.delete(From);
      twimlResponse.message('❌ Your complaint process has been cancelled. Send "Hi" to start again.');
      res.type('text/xml').send(twimlResponse.toString());
      return;
    }

    switch (session.state) {
      case 'START':
        session.state = 'AWAITING_DESC';
        twimlResponse.message(
          '👋 Welcome to the Smart City Grievance Reporting Bot!\n\n' +
          'To report an issue, please reply with a short description of the problem (e.g., "Streetlight not working").\n\n' +
          'Reply "cancel" at any time to stop.'
        );
        break;

      case 'AWAITING_DESC':
        console.log(`Analyzing description with AI: ${Body}`);
        const aiResult = await categorizeComplaint(Body || '');
        console.log('AI Analysis Result:', aiResult);

        session.complaintData.description = Body;
        session.complaintData.aiAnalysis = aiResult;
        
        session.state = 'AWAITING_PHOTO';
        twimlResponse.message(
          `🤖 AI Analysis: I've categorized this as *${aiResult.category}* for the *${aiResult.department}* department.\n\n` +
          `📸 Now, please attach a photo of the issue, or reply "skip" if you do not have one.`
        );
        break;

      case 'AWAITING_PHOTO':
        if (MediaUrl0) {
          session.complaintData.imageUrl = MediaUrl0;
        } else if (Body && Body.trim().toLowerCase() !== 'skip') {
          // They sent text but we expected an image or 'skip'
          twimlResponse.message('Please attach an image, or explicitly reply with "skip" to proceed without an image.');
          res.type('text/xml').send(twimlResponse.toString());
          return;
        }
        
        session.state = 'AWAITING_LOCATION';
        twimlResponse.message('📍 Got it! Please send your Live or Current Location using the WhatsApp attachment (📎 -> Location). \n\n(Or reply with your area name if you cannot send location pins)');
        break;

      case 'AWAITING_LOCATION':
        console.log('Final Step: Processing Location/Address');
        let lng = 77.2090; // Default exact fallback (e.g., Delhi center)
        let lat = 28.6139;
        let area = 'Unknown Area (from WhatsApp)';

        if (Latitude && Longitude) {
          lat = parseFloat(Latitude);
          lng = parseFloat(Longitude);
          area = 'Pinned Location from WhatsApp';
          console.log(`Location Pin detected: ${lat}, ${lng}`);
        } else if (Body) {
          // User typed an address manually
          area = Body;
          console.log(`Manual Address detected: ${area}`);
        }

        // Generate ID
        const complaintId = 'WHATSAPP-' + crypto.randomBytes(4).toString('hex').toUpperCase();

        const slaDeadline = new Date();
        slaDeadline.setDate(slaDeadline.getDate() + 3); // 3 days default

        // Map AI department name to real Department ID
        let matchedDeptId = null;
        let finalDeptName = session.complaintData.aiAnalysis?.department || 'zone 1';

        try {
           // 1. Get all active departments to show AI what's available
           const allDepts = await Department.find({ isActive: true });
           const deptNames = allDepts.map(d => d.name).join(', ');

           // 2. Try to find the closest match from AI suggestion
           let deptDoc = await Department.findOne({ 
             name: { $regex: new RegExp(finalDeptName, 'i') } 
           });
           
           // 3. If no match, try specific names seen in your UI (zone 1, TI)
           if (!deptDoc) {
             deptDoc = await Department.findOne({ 
               name: { $regex: /zone 1|TI/i } 
             });
           }

           // 4. Final Fallback: First department in list
           if (!deptDoc && allDepts.length > 0) {
             deptDoc = allDepts[0];
           }

           if (deptDoc) {
             matchedDeptId = deptDoc._id as any;
             finalDeptName = deptDoc.name;
             console.log(`REAL-TIME MAPPING: Assigned to ${finalDeptName} (${matchedDeptId})`);
           }
        } catch (e) {
           console.log("Dept ID Mapping error", e);
        }

        // Save to Database
        console.log('Attempting to save complaint to DB...');
        const newComplaint = new Complaint({
          complaintId,
          description: session.complaintData.description || 'WhatsApp Complaint',
          category: session.complaintData.aiAnalysis?.category || 'General Administration',
          status: 'pending',
          department: finalDeptName,
          departmentId: matchedDeptId,
          priority: session.complaintData.aiAnalysis?.priority || 'MEDIUM',
          userId: From,
          userName: `WhatsApp User`,
          imageUrls: session.complaintData.imageUrl ? [session.complaintData.imageUrl] : [],
          slaDeadline,
          location: {
            type: 'Point',
            coordinates: [lng, lat],
            area: area,
            district: 'Delhi'
          },
          timeline: [
            { step: 'Complaint registered via WhatsApp', time: new Date() }
          ],
          notes: []
        });

        await newComplaint.save();
        console.log(`SUCCESS: Complaint ${complaintId} saved!`);

        twimlResponse.message(
          `✅ Your complaint has been successfully registered!\n\n` +
          `📝 *Tracking ID*: ${complaintId}\n\n` +
          `We will notify you here when the status changes. Thank you.`
        );

        // Clear session after completion
        userSessions.delete(From);
        res.type('text/xml').send(twimlResponse.toString());
        return; // Don't save the session back
    }

    // Save updated session
    userSessions.set(From, session);
    console.log(`New Session State for ${From} -> ${session.state}`);
    res.type('text/xml').send(twimlResponse.toString());

  } catch (error) {
    console.error('CRITICAL ERROR in WhatsApp Webhook:', error);
    twimlResponse.message('⚠️ Sorry, something went wrong on our end. Please try again later.');
    res.type('text/xml').send(twimlResponse.toString());
  }
};

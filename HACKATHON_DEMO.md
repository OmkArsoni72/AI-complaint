# 🚀 AI-Powered Smart City Grievance Intelligence System

### *“Beyond Apps: Bridging the Governance Gap with AI & WhatsApp”*

## 🌟 The Innovation (USP)
While every city has a complaint portal, **80% of citizens never download the app.** We solved this by bringing the government strictly into the citizen's pocket via **WhatsApp Automation** powered by **Google Gemini AI**.

---

## 🛠️ The Core Problem we Solved
1. **Low Adoption:** People hate downloading new apps for one-time complaints.
2. **Manual Categorization:** Government staff spend hours sorting complaints into departments.
3. **Inaccurate Data:** Lack of photos and precise locations makes it hard for field officers to resolve issues.

## 💡 Our Solution: The AI-WhatsApp Pipeline
Our system allows a citizen to report a problem in **30 seconds** without ever leaving WhatsApp.

### 🔄 The Smart Flow:
1.  **Conversational Entry:** User sends a "Hi" on WhatsApp (Twilio API).
2.  **AI Understanding:** **Google Gemini 1.5 Flash** analyzes the user's description in real-time.
    *   *Example:* "There is an open manhole" -> AI detects **Category: Sewerage**, **Dept: Jal Board**, **Priority: URGENT**.
3.  **Visual Evidence:** User uploads a photo; the system stores it as proof for the officer.
4.  **Pinpoint Accuracy:** User sends their **WhatsApp Live Location**. Our system maps the coordinates to the specific city zone.
5.  **Automated Routing:** The complaint doesn't sit in a queue; it's instantly visible on the **Specific Department Admin's Dashboard** (e.g., Bhilai Police or Zone 1).

---

## ⚡ Technical Excellence (The Stack)
- **Frontend:** Next.js (Admin & Officer Intelligence Dashboards)
- **Backend:** Node.js (Express) with TypeScript
- **Database:** MongoDB (Geospatial indexing for location tracking)
- **Communications:** Twilio WhatsApp API
- **AI Brain:** Google Gemini Nano/Flash (Categorization, Dept Mapping, Priority Detection)
- **Tunneling:** Ngrok for real-time mobile-to-local testing

---

## 📊 Impact & Future Scope
- **Instant Response:** Citizens get an AI-curated acknowledgment immediately.
- **Smart Analytics:** Heatmap of complaints for the city commissioner.
- **Auto-Escalation:** If a complaint isn't resolved in 48 hours, the AI alerts the Super Admin.

---

## 🎤 Advice for the Demo:
1.  **Start with the "Hi"**: Show the judge how the bot replies instantly.
2.  **Mention the AI**: Highlight that "I didn't select the department; Gemini AI understood my text and assigned it."
3.  **Show the Admin Panel**: Refresh your dashboard and show the complaint appearing with the photo and location immediately.

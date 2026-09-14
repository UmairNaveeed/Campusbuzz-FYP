PRIJECT TITLE: CampusBuzz

GROUP MEMBERS:
Umair            221370046
Rida Fatima      221370011
Saman Zulfiqar   221370012
Ruba Bilal Butt  221370185
Danish Ali       222370007


============================================== DESCRIPTION: =====================================================

CampusBuzz is a university-exclusive microblogging platform designed for GIFT University's students and alumni. It provides a centralized space for sharing updates, ideas
, academic discussions, and campus experiences through short posts and interactive communication. The platform offers features such as personalized feeds, discussion 
forums, private messaging, and trending topics to enhance user engagement. Additionally, CampusBuzz integrates sentiment analysis to analyze the emotional tone of 
user-generated content and hate speech detection to identify potentially harmful or offensive posts, helping promote a safer and more positive online environment. 
By combining social networking with intelligent analytics, CampusBuzz fosters a more connected, collaborative, and engaging university community.

================================================= MODULES: ================================================
User Authentication and Authorization
User registration, login, logout, authentication, and access control.
Profile Management
User profiles, academic details, profile updates, and follow/unfollow functionality.
Post Creation and Interaction
Create posts, upload media, like, comment, reply, hashtags, mentions, and report posts.
List Filtration
Create custom lists, personalized feeds, manage lists, and filter content.
Sentiment Analysis and Hate Speech Detection (Machine Learning Module)
Analyze user-generated content, classify sentiment (positive, negative, neutral), detect hate speech, compute scores, and provide analysis results to other modules.
Admin Dashboard and Analytics
User management, content moderation, analytics, reports, announcements, complaints, and sentiment/trend visualization.
Messaging
Private messaging, notifications, media sharing, message search, reactions, blocking users, and end-to-end encryption.
Discussion Forum
Department-based discussion groups, replies, reactions, notifications, hashtags, mentions, and content moderation.
Trends
Identify and display university-wide and department-specific trending topics and discussions based on engagement.

=========================================== TOOLS AND TECHNOLOGIES:================================================

==== Programming Language: ===
Python
JavaScript (Node.js)
Frontend Technologies
React.js,
=== Web Framework (Backend):===
Express.js
Version control:
Git
GitHub
=== Database management:===
MongoDB
ML Model:
XLM-RoBERTa T
=== Authentication: ===
Firebase

================================================= PROJECT STRUCTURE:=====================================

CampusBuzz

├── Backend/
├── Frontend/
├── MLService/

---

## Installation
## Installation & Configuration

### 1. Clone the Repository
git clone https://github.com/UmairNaveeed/Campusbuzz-FYP.git
cd Campusbuzz-FYP

### 2. Install Dependencies
# Install Backend
cd Backend
npm install

# Install Frontend
cd ../Frontend
npm install

# Install ML Service
cd ../MLService
pip install -r requirements.txt

### 3. Environment & Credentials Setup (Crucial)
Because security keys are excluded from version control, you must configure your local environment:

- MongoDB: Ensure your local MongoDB instance is running (via MongoDB Compass or MongoDB service) on `mongodb://localhost:27017` or set up your connection string.
- **Firebase:** Generate your Firebase service account JSON key from your Firebase Console and place it at:
  `Backend/firebaseAdmin/serviceAccountKey.json`

---

## Running the Project

### Backend

cd Backend

npm start

### Frontend

cd Frontend

npm run dev

### ML Service

cd MLService

python app.py


#  Felicity Event Management System (MERN)

A full-stack **event management platform** designed to streamline event organization, registrations, and participation workflows.
Built using the **MERN stack**, the system supports **role-based access (Admin, Organizer, Participant)** and includes real-time and advanced workflow features.

---

## Key Highlights

*  Role-based authentication (JWT + bcrypt)
*  Event registration with **QR-based ticketing**
*  Organizer dashboards with analytics
*  Real-time discussion forum (Socket.IO)
*  Team chat for collaborative events
*  Calendar integration (.ics export + Google/Outlook support)
*  PDF ticket generation with QR codes

---

##  Tech Stack

### Frontend

* **React** – Component-based UI
* **React Router DOM** – Client-side routing
* **Axios** – API communication with JWT interceptors
* **Socket.IO Client** – Real-time updates
* **Vite** – Fast build tool
* **CSS** – Custom styling

### Backend

* **Node.js + Express** – REST API server
* **MongoDB Atlas + Mongoose** – Database and schema modeling
* **JWT + bcryptjs** – Authentication & security
* **Socket.IO** – Real-time communication
* **Nodemailer** – Email service (tickets, password reset)
* **PDFKit + QRCode** – Ticket generation
* **dotenv + cors** – Config & security

---

##  Core Features

### Authentication & Roles

* Secure login/signup system
* Role-based access: **Admin | Organizer | Participant**
* Protected routes using JWT

---

### Event Management

* Create, edit, and publish events
* Event types: Normal / Merchandise
* Registration limits, deadlines, and eligibility filters
* Dynamic event browsing with search and filters

---

### Registration & Ticketing

* Seamless event registration
* Auto-generated **PDF tickets with QR codes**
* Email confirmation system
* Participation history tracking

---

### Organizer Dashboard

* View and manage events
* Track registrations, attendance, and analytics
* Export participant and attendance data

---

## Advanced Features

### QR Scanner & Attendance Tracking

* Scan QR codes via camera/file upload
* Prevent duplicate entries
* Live attendance tracking
* CSV export + manual override

---

### Real-Time Discussion Forum

* Event-based chat rooms
* Only registered users can participate
* Organizer moderation (pin/delete messages)
* Notifications + reactions + threaded replies

---

### Team Chat System

* Private team communication rooms
* Real-time messaging + history
* Typing indicators and online status
* File/link sharing support

---

### Calendar Integration

* Export events as `.ics` files
* One-click add to **Google Calendar / Outlook**
* Timezone-aware reminders

---

## Local Setup

### 1️⃣ Install Dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

---

### 2️⃣ Configure Environment Variables

Create `.env` inside `backend/`:

```
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret

SMTP_HOST=smtp_provider
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email
SMTP_PASS=your_password
SMTP_FROM_NAME=Felicity
SMTP_FROM_EMAIL=your_email

FRONTEND_URL=http://localhost:5173
```

---

### 3️⃣ Run the Application

#### Backend

```bash
cd backend
npm run dev
```

#### Frontend

```bash
cd frontend
npm run dev
```

---

### 4️⃣ Access

* Frontend → http://localhost:5173
* Backend → http://localhost:5000/api

---

## Project Structure

```
Felicity-Event-Management/
│
├── backend/
│   ├── models/
│   ├── routes/
│   ├── controllers/
│   └── config/
│
├── frontend/
│   ├── components/
│   ├── pages/
│   └── services/
```

---

## Security Features

* Password hashing using bcrypt
* JWT-based authentication
* Role-based route protection
* Secure API communication with CORS

---

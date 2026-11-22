import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

import Login from "./Login/Login.jsx";
import Questionnaire from "./Questionnaire/Questionnaire.jsx";
import StartQuestionnaire from "./Questionnaire/StartQuestionnaire.jsx";
import Register from "./Register/Register.jsx";
import Home from "./Home/Home.jsx";
import Error from "./Error/Error.jsx";
import SecurisedRoute from "./SecurisedRoute.jsx";
import ForumHome from "./Forum/ForumHome.jsx";
import DashboardLayout from "./Layout/DashboardLayout.jsx";
import EmployeesList from "./Employees/EmployeesList.jsx";
import Profile from "./Profile/Profile.jsx";
import Ressources from "./Espace Ressource/Ressources.jsx";
import PsychoBot from "./Psychobot/Psychobot.jsx";
import LandingPage from './LandingPage/LandingPage';


createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/start_questionnaire"
          element={
            <SecurisedRoute>
              <DashboardLayout>
                <StartQuestionnaire />
              </DashboardLayout>
            </SecurisedRoute>
          }
        />
        <Route
          path="/questionnaire"
          element={
            <SecurisedRoute>
              <DashboardLayout>
                <Questionnaire />
              </DashboardLayout>
            </SecurisedRoute>
          }
        />
        <Route path="/dashboard" element={<SecurisedRoute><DashboardLayout /></SecurisedRoute>} />
        <Route path="/feedback" element={<SecurisedRoute><DashboardLayout /></SecurisedRoute>} />
        <Route path="/ressource" element={<SecurisedRoute><DashboardLayout><Ressources /></DashboardLayout></SecurisedRoute>} />
        <Route path="/employees" element={<SecurisedRoute><DashboardLayout><EmployeesList /></DashboardLayout></SecurisedRoute>} />
        <Route path="/profile" element={<SecurisedRoute><DashboardLayout><Profile /></DashboardLayout></SecurisedRoute>} />
        <Route
          path="/forum"
          element={
            <SecurisedRoute>
              <DashboardLayout>
                <ForumHome />
              </DashboardLayout>
            </SecurisedRoute>
          }
        />
        <Route path="/ForumHome" element={<ForumHome />} />
        <Route path="/psychobot" element={<SecurisedRoute><PsychoBot /></SecurisedRoute>} />

        <Route path="*" element={<Error />} />


      </Routes>
    </BrowserRouter>
  </StrictMode>
  
);

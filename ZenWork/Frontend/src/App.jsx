import { useState } from "react";
import { useNavigate } from "react-router-dom";
import EmployeeLogin from "./EmployeeLogin.jsx";
import RhLogin from "./RhLogin.jsx";
import styles from "./login.module.css";
import EmployeeLogin from "./EmployeeLogin";
import RhLogin from "./RhLogin";
import ForumHome from "./Forum/ForumHome";
import './Forum/forum.css';
import './login.css';
import Resources from "./Espace Ressource/Ressources.jsx";
import Psychobot from './Psychobot/Psychobot'; 


function App() {
  const navigate = useNavigate();
  const [space, setSpace] = useState("employee");
  const [logged, setLogged] = useState(false);
  const [role, setRole] = useState(null);

  {/* ce if est temporaire car il permet uniquement de passer directement 
   au forum une fois connecté en tant qu'employé */}
  if (logged) {
      return <ForumHome userRole={role} />;
    }

  return (
    <div className={styles.container}>
      {/* on a besoin de container ici car, on a pas de body */}
      <div className={styles.left}>
        {/* on choisit l'image en fonction de si l'utilisateur active */}
        {/* le dark theme ou non */}
        <img className={styles.img} src={DarkTheme ? "public/login_pic_dark.png" : "public/login_pic.png"} alt="login pic" />
      </div>
      <div className={styles.right}>
        <div className={styles.div}>
          {/* logo tout pixelise a change */}
          <img className={styles.img} src={DarkTheme ? "/zenwork_logo_dark.png" : "/zenwork_logo.png"} alt="zenwork logo" />
        </div>
        <div className={styles.choice}>
          {/* expression ternaire pour mettre l'un a in et l'autre a out pour */}
          {/* que dans le css on puisse souligner l'un en bleu et l'autre en gris */}
          <button
            className={`${styles.button} ${space === "employee" ? styles.in : styles.out}`}
            onClick={() => setSpace("employee")}
          >
            Employé
          </button>
          <button
            className={`${styles.button} ${space === "rh" ? styles.in : styles.out}`}
            onClick={() => setSpace("rh")}
          >
            RH
          </button>
        </div>
        
        {/* On passe setLogged et setRole au login */}
        {space === "employee" && (<EmployeeLogin onSuccess={() => { 
          setLogged(true); setRole("employee"); }}/>)}

        {space === "rh" && (<RhLogin onSuccess={() => { 
          setLogged(true); setRole("rh"); }}/>)}
      </div>
    </div>
  );
}

export default App;

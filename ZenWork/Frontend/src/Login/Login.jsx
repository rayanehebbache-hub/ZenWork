import { useState } from "react";
import { useNavigate } from "react-router-dom";
import EmployeeLogin from "./EmployeeLogin.jsx";
import RhLogin from "./RhLogin.jsx";
import Register from "../Register/Register.jsx";
import styles from "./login.module.css";

function Login() {
  const [space, setSpace] = useState("employee");
  const DarkTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const navigate = useNavigate();
  return (
    <div className={styles.loginWrapper}>
      <div className={styles.container}>
        {/* on a besoin de container ici car, on a pas de body */}
        <div className={styles.left}>
          {/* on choisit l'image en fonction de si l'utilisateur active */}
          {/* le dark theme ou non */}
          <img className={styles.img} src={DarkTheme ? "public/login_pic_dark.png" : "public/login_pic.png"} alt="login pic" />
        </div>
        <div className={styles.right}>
          <div className={styles.div}>
            <img className={styles.img} src={DarkTheme ? "public/zenwork_final_login_dark.png" : "public/zenwork-final-login.png"} alt="zenwork logo" />
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
          {space === "employee" && <EmployeeLogin />}
          {space === "rh" && <RhLogin />}
          <p className={styles.register} onClick={() => navigate("/register")}>
            Créer un compte
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;

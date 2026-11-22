import styles from "./noQuestionnaire.module.css";

function NoQuestionnaire() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Il n'y a pas de questionnaire disponible pour le moment</h1>
    </div>
  );
}

export default NoQuestionnaire;
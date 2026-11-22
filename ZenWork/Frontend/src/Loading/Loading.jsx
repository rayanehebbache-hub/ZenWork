import styles from "./loading.module.css";

function Loading() {
  return (
    <div className={styles.loadingContainer}>
      <h1 className={styles.text}>Loading</h1>
    </div>
  );
}

export default Loading;
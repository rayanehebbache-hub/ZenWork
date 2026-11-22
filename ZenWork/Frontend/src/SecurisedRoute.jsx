import { useParams } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { useEffect, useState } from "react";
import Error from "./Error/Error.jsx";
import React from "react";

function SecurisedRoute({ children }) {
  const params = useParams();
  const routeUserId = params.id || params.userId;
  const [user, setUser] = useState(null);
  // loading car l'operation peut potentiellement prendre du temps
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function fetchUser() {
      const { data: { session } } = await supabase.auth.getSession();
      // on verifie que la session existe et qu'il y ai bien un utilisateur connecte
      if (session && session.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    }
    fetchUser();
    // onAuthStateChange comme un addEventListener en js classique
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  if (loading) {
    return <p>Loading</p>;
  }
  if (!user) {
    return <Error />;
  }
  if (routeUserId  && user.id !== routeUserId) {
    return <Error />
  }
  return children ? React.cloneElement(children, { user }) : null;
}

export default SecurisedRoute;
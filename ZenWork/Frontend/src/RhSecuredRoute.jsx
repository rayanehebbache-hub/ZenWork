import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Error from "./Error/Error.jsx";
import Loading from "./Loading/Loading.jsx";

/**
 * Wraps content that should only be visible to RH.
 * Must be used inside SecurisedRoute (receives user from parent).
 */
function RhSecuredRoute({ user, children }) {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (!error && data) {
        setRole(data.role);
      } else {
        setRole(null);
      }
      setLoading(false);
    }
    fetchRole();
  }, [user?.id]);

  if (loading) return <Loading />;
  if (role !== "RH") return <Error />;
  return children;
}

export default RhSecuredRoute;

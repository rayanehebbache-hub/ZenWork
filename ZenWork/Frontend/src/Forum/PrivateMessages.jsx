import { useEffect, useMemo, useState } from "react";
import { formatDate } from "./forumUtils";
import {
  fetchMembersExcept,
  fetchProfilesByIds,
  fetchPrivateMessages,
  sendPrivateMessage,
  fetchDirectThreads,
  fetchUserGroups,
  fetchGroupMembers,
  fetchGroupMessages,
  createMessageGroup,
  sendGroupMessage,
} from "./forumService";

function getDisplayName(profile) {
  return [profile?.prenom, profile?.nom].filter(Boolean).join(" ") || "Utilisateur";
}

function isAutoGroupName(name) {
  return name === "__auto__";
}

export default function PrivateMessages({ user }) {
  const [members, setMembers] = useState([]);
  const [directThreads, setDirectThreads] = useState([]);
  const [groups, setGroups] = useState([]);

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);

  const [threadType, setThreadType] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const [loadingSidebar, setLoadingSidebar] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [showNewDirect, setShowNewDirect] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const [searchDirect, setSearchDirect] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  async function refreshSidebar() {
    if (!user?.id) return;

    setLoadingSidebar(true);
    setErrorMessage("");

    const [membersResult, directResult, groupsResult] = await Promise.allSettled([
      fetchMembersExcept(user.id),
      fetchDirectThreads(user.id),
      fetchUserGroups(user.id),
    ]);

    if (membersResult.status === "fulfilled") {
      setMembers(membersResult.value);
    } else {
      console.error("Erreur chargement membres :", membersResult.reason);
      setMembers([]);
    }

    if (directResult.status === "fulfilled") {
      setDirectThreads(directResult.value);
    } else {
      console.error("Erreur chargement discussions privées :", directResult.reason);
      setDirectThreads([]);
    }

    if (groupsResult.status === "fulfilled") {
      setGroups(groupsResult.value);
    } else {
      console.error("Erreur chargement groupes :", groupsResult.reason);
      setGroups([]);
    }

    setLoadingSidebar(false);
  }

  useEffect(() => {
    refreshSidebar();
  }, [user?.id]);

  useEffect(() => {
    async function loadMessages() {
      if (!user?.id) return;

      setLoadingMessages(true);
      setErrorMessage("");

      try {
        if (threadType === "direct" && selectedUser?.id) {
          const data = await fetchPrivateMessages(user.id, selectedUser.id);
          setMessages(data);
          setSelectedGroupMembers([]);
        } else if (threadType === "group" && selectedGroup?.id) {
          const [messagesData, membersData] = await Promise.all([
            fetchGroupMessages(selectedGroup.id),
            fetchGroupMembers(selectedGroup.id),
          ]);

          setMessages(messagesData);
          setSelectedGroupMembers(membersData);
        } else {
          setMessages([]);
          setSelectedGroupMembers([]);
        }
      } catch (error) {
        console.error("Erreur chargement conversation :", error.message);
        setMessages([]);
        setSelectedGroupMembers([]);
        setErrorMessage("Impossible de charger la conversation.");
      } finally {
        setLoadingMessages(false);
      }
    }

    loadMessages();
  }, [threadType, selectedUser?.id, selectedGroup?.id, user?.id]);

  function openDirectConversation(member) {
    setSelectedGroup(null);
    setSelectedGroupMembers([]);
    setSelectedUser(member);
    setThreadType("direct");
    setText("");
    setShowNewDirect(false);
  }

  function openGroupConversation(group) {
    setSelectedUser(null);
    setSelectedGroup(group);
    setThreadType("group");
    setText("");
    setShowCreateGroup(false);
  }

  function toggleGroupMember(memberId) {
    setGroupMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  }

  async function handleCreateGroup() {
    if (groupMemberIds.length === 0) {
      setErrorMessage("Sélectionne au moins un autre membre.");
      return;
    }

    const totalParticipants = groupMemberIds.length + 1;
    const requiresCustomName = totalParticipants > 2;

    if (requiresCustomName && !groupName.trim()) {
      setErrorMessage("Le nom du groupe est obligatoire à partir de 3 personnes.");
      return;
    }

    setCreatingGroup(true);
    setErrorMessage("");

    try {
      await createMessageGroup({
        creatorId: user.id,
        name: requiresCustomName ? groupName.trim() : "",
        memberIds: groupMemberIds,
      });

      await refreshSidebar();

      setShowCreateGroup(false);
      setGroupName("");
      setGroupMemberIds([]);
    } catch (error) {
      console.error("Erreur création groupe :", error.message);
      setErrorMessage("Impossible de créer le groupe.");
    } finally {
      setCreatingGroup(false);
    }
  }

  async function handleSendMessage() {
    if (!text.trim()) return;

    setSending(true);
    setErrorMessage("");

    try {
      if (threadType === "direct" && selectedUser?.id) {
        await sendPrivateMessage({
          senderId: user.id,
          receiverId: selectedUser.id,
          content: text.trim(),
        });

        const refreshed = await fetchPrivateMessages(user.id, selectedUser.id);
        setMessages(refreshed);
        await refreshSidebar();
      } else if (threadType === "group" && selectedGroup?.id) {
        await sendGroupMessage({
          groupId: selectedGroup.id,
          senderId: user.id,
          content: text.trim(),
        });

        const refreshed = await fetchGroupMessages(selectedGroup.id);
        setMessages(refreshed);
      }

      setText("");
    } catch (error) {
      console.error("Erreur envoi message :", error.message);
      setErrorMessage("Impossible d’envoyer le message.");
    } finally {
      setSending(false);
    }
  }

  const filteredMembersForDirect = useMemo(() => {
    const q = searchDirect.trim().toLowerCase();
    if (!q) return members;

    return members.filter((member) =>
      [member?.prenom, member?.nom, member?.role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [members, searchDirect]);

  const filteredMembersForGroup = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return members;

    return members.filter((member) =>
      [member?.prenom, member?.nom, member?.role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [members, groupSearch]);

  function resolveGroupLabel(group) {
    if (!group) return "Groupe";

    if (!isAutoGroupName(group.name)) {
      return group.name;
    }

    const otherMembers = selectedGroup?.id === group.id
      ? selectedGroupMembers.filter((m) => m.id !== user.id)
      : [];

    if (otherMembers.length === 1) {
      return getDisplayName(otherMembers[0]);
    }

    return "Discussion privée";
  }

  const selectedThreadLabel = useMemo(() => {
    if (threadType === "direct" && selectedUser) {
      return getDisplayName(selectedUser);
    }

    if (threadType === "group" && selectedGroup) {
      if (
        isAutoGroupName(selectedGroup.name) &&
        selectedGroupMembers.length === 2
      ) {
        const other = selectedGroupMembers.find((m) => m.id !== user.id);
        return other ? getDisplayName(other) : "Discussion privée";
      }

      return selectedGroup.name || "Groupe";
    }

    return "Aucune conversation sélectionnée";
  }, [threadType, selectedUser, selectedGroup, selectedGroupMembers, user.id]);

  const selectedThreadMeta = useMemo(() => {
    if (threadType === "direct" && selectedUser?.role) {
      return selectedUser.role;
    }

    if (threadType === "group" && selectedGroupMembers.length > 0) {
      const names = selectedGroupMembers
        .filter((member) => member.id !== user.id)
        .map(getDisplayName);

      if (selectedGroupMembers.length === 2) {
        return "Discussion privée";
      }

      return names.join(", ");
    }

    return "";
  }, [threadType, selectedUser, selectedGroupMembers, user.id]);

  return (
    <div className="private-messages-layout">
      <section className="forum-card private-messages-users">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <h3 style={{ margin: 0 }}>Messagerie</h3>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="forum-tool-btn"
              onClick={() => {
                setShowNewDirect((prev) => !prev);
                setShowCreateGroup(false);
              }}
            >
              {showNewDirect ? "Fermer" : "Nouvelle discussion"}
            </button>

            <button
              type="button"
              className="forum-tool-btn"
              onClick={() => {
                setShowCreateGroup((prev) => !prev);
                setShowNewDirect(false);
              }}
            >
              {showCreateGroup ? "Fermer" : "Nouveau groupe"}
            </button>
          </div>
        </div>

        {errorMessage && (
          <p style={{ color: "#E53E3E", marginTop: 0 }}>{errorMessage}</p>
        )}

        {showNewDirect && (
          <div className="video-card" style={{ padding: 12, borderRadius: 16, marginBottom: 14 }}>
            <input
              type="text"
              value={searchDirect}
              onChange={(e) => setSearchDirect(e.target.value)}
              placeholder="Rechercher un collaborateur..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                marginBottom: 10,
                boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto" }}>
              {filteredMembersForDirect.length === 0 ? (
                <p style={{ margin: 0 }}>Aucun résultat.</p>
              ) : (
                filteredMembersForDirect.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className="forum-tool-btn"
                    style={{ textAlign: "left", justifyContent: "flex-start" }}
                    onClick={() => openDirectConversation(member)}
                  >
                    {getDisplayName(member)} {member.role ? `(${member.role})` : ""}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {showCreateGroup && (
          <div className="video-card" style={{ padding: 12, borderRadius: 16, marginBottom: 14 }}>
            <input
              type="text"
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              placeholder="Rechercher des membres..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                marginBottom: 10,
                boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
              {filteredMembersForGroup.length === 0 ? (
                <p style={{ margin: 0 }}>Aucun résultat.</p>
              ) : (
                filteredMembersForGroup.map((member) => {
                  const checked = groupMemberIds.includes(member.id);

                  return (
                    <label
                      key={member.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 14,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGroupMember(member.id)}
                      />
                      {getDisplayName(member)} {member.role ? `(${member.role})` : ""}
                    </label>
                  );
                })
              )}
            </div>

            {groupMemberIds.length + 1 > 2 && (
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Nom du groupe"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  marginTop: 12,
                  boxSizing: "border-box",
                }}
              />
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="forum-tool-btn"
                onClick={handleCreateGroup}
                disabled={creatingGroup}
              >
                {creatingGroup ? "Création..." : "Créer le groupe"}
              </button>
            </div>
          </div>
        )}

        {loadingSidebar ? (
          <p>Chargement...</p>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: "0 0 8px 0" }}>Discussions privées</h4>

              {directThreads.length === 0 ? (
                <p style={{ margin: 0 }}>Aucune discussion privée pour le moment.</p>
              ) : (
                <ul className="forum-member-list">
                  {directThreads.map((member) => {
                    const active =
                      threadType === "direct" && selectedUser?.id === member.id;

                    return (
                      <li key={member.id} className="forum-member-item">
                        <button
                          className={active ? "active-contact" : ""}
                          onClick={() => openDirectConversation(member)}
                        >
                          {getDisplayName(member)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div>
              <h4 style={{ margin: "0 0 8px 0" }}>Groupes</h4>

              {groups.length === 0 ? (
                <p style={{ margin: 0 }}>Aucun groupe pour le moment.</p>
              ) : (
                <ul className="forum-member-list">
                  {groups.map((group) => {
                    const active =
                      threadType === "group" && selectedGroup?.id === group.id;

                    return (
                      <li key={group.id} className="forum-member-item">
                        <button
                          className={active ? "active-contact" : ""}
                          onClick={() => openGroupConversation(group)}
                        >
                          👥 {resolveGroupLabel(group)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </section>

      <section className="forum-card private-messages-thread">
        <h3>{selectedThreadLabel}</h3>

        {selectedThreadMeta && (
          <p style={{ marginTop: -4, color: "#718096" }}>{selectedThreadMeta}</p>
        )}

        {!threadType ? (
          <p>Sélectionne une discussion ou crée-en une nouvelle.</p>
        ) : loadingMessages ? (
          <p>Chargement de la conversation...</p>
        ) : (
          <>
            <div className="private-message-list">
              {messages.length === 0 ? (
                <p>Aucun message pour le moment.</p>
              ) : (
                messages.map((message) => {
                  const isMine = message.sender_id === user.id;

                  return (
                    <div
                      key={message.id}
                      className={`private-message ${isMine ? "mine" : "theirs"}`}
                    >
                      <p style={{ margin: 0 }}>{message.content}</p>
                      <small>{formatDate(message.created_at)}</small>
                    </div>
                  );
                })
              )}
            </div>

            <div className="private-message-composer">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  threadType === "group"
                    ? "Écrire un message au groupe..."
                    : "Écrire un message privé..."
                }
              />
              <button onClick={handleSendMessage} disabled={sending || !text.trim()}>
                {sending ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
import { useState, useEffect, useRef, useCallback } from "react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import ThemeToggle from "./compoent/ThemeToggle";
import { io } from "socket.io-client";
import "bootstrap/dist/css/bootstrap.min.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./Chat.css";

const socket = io("https://globalconnect.up.railway.app/", {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Utility function to generate consistent color from username
const getUsernameColor = (username) => {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 60%)`;
};

export default function Chat() {
  // State management
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [userName, setUserName] = useState(
    localStorage.getItem("username") || ""
  );
  const [displayName, setDisplayName] = useState(
    localStorage.getItem("displayName") || ""
  );
  const [showNameModal, setShowNameModal] = useState(
    !localStorage.getItem("username")
  );
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Refs
  const chatBoxRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Memoized functions
  const scrollToBottom = useCallback(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTo({
        top: chatBoxRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  const handleEmojiClick = useCallback((emojiData) => {
    setMessage((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  }, []);

  // Socket event handlers
  const handleNewMessage = useCallback(
    (msg) => {
      setMessages((prev) => [...prev, msg]);

      if (msg.username === "System") {
        if (
          msg.text.includes("Welcome") &&
          !localStorage.getItem("hasJoined")
        ) {
          toast.success(msg.text);
          localStorage.setItem("hasJoined", "true");
        } else if (msg.text.includes("joined") || msg.text.includes("left")) {
          toast.info(msg.text);
        }
      }

      scrollToBottom();
    },
    [scrollToBottom]
  );

  const handleTypingEvent = useCallback((user) => {
    setTypingUser(user);
  }, []);

  const handleStopTypingEvent = useCallback(() => {
    setTypingUser("");
  }, []);

  const handleUsernameAssigned = useCallback(
    ({ actualUsername, displayUsername }) => {
      setUserName(actualUsername);
      setDisplayName(displayUsername);
      localStorage.setItem("username", actualUsername);
      localStorage.setItem("displayName", displayUsername);
      if (actualUsername !== displayUsername) {
        toast.info(`Your display name is ${displayUsername}`);
      }
    },
    []
  );

  // Effects
  useEffect(() => {
    // Connection status
    socket.on("connect", () => {
      setIsConnected(true);
      if (userName) {
        socket.emit("new user", { requestedUsername: userName });
      }
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    // Message handling
    socket.on("chat message", handleNewMessage);
    socket.on("typing", handleTypingEvent);
    socket.on("stop typing", handleStopTypingEvent);
    socket.on("username assigned", handleUsernameAssigned);

    return () => {
      socket.off("chat message", handleNewMessage);
      socket.off("typing", handleTypingEvent);
      socket.off("stop typing", handleStopTypingEvent);
      socket.off("username assigned", handleUsernameAssigned);
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [
    userName,
    handleNewMessage,
    handleTypingEvent,
    handleStopTypingEvent,
    handleUsernameAssigned,
  ]);

  // Emoji picker click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Event handlers
  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && userName) {
      const timestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const msg = {
        username: userName,
        displayName: displayName || userName,
        text: message,
        time: timestamp,
      };

      socket.emit("chat message", msg);
      socket.emit("stop typing");
      setMessage("");
    }
  };

  const handleTyping = () => {
    if (!typingTimeoutRef.current) {
      socket.emit("typing", displayName || userName);
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop typing");
      typingTimeoutRef.current = null;
    }, 1000);
  };

  const handleStopTyping = () => {
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop typing");
      typingTimeoutRef.current = null;
    }, 1000);
  };

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (userName.trim()) {
      socket.emit("new user", { requestedUsername: userName });
      setShowNameModal(false);
      // Focus the input after a small delay to ensure it's rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleLeaveChat = () => {
    setShowLeaveModal(true);
  };

  const confirmLeaveChat = () => {
    socket.emit("user left", { username: userName, displayName });
    localStorage.removeItem("username");
    localStorage.removeItem("displayName");
    localStorage.removeItem("hasJoined");
    setUserName("");
    setDisplayName("");
    setMessages([]);
    setShowLeaveModal(false);
    setShowNameModal(true);
  };

  const cancelLeaveChat = () => {
    setShowLeaveModal(false);
  };

  const toggleEmojiPicker = () => {
    setShowEmojiPicker((prev) => !prev);
    inputRef.current?.focus();
  };

  return (
    <div className="container py-4">
      {/* Connection status indicator */}
      <div
        className={`connection-status ${
          isConnected ? "connected" : "disconnected"
        }`}
      >
        {isConnected ? "Online" : "Offline"}
      </div>

      {/* Name entry modal */}
      {showNameModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-content">
              <header className="modal-header">
                <h2 className="modal-title">Welcome to GupShupCorner</h2>
                <p className="modal-subtitle">Let's get started</p>
              </header>

              <div className="modal-body">
                <form onSubmit={handleNameSubmit} className="name-form">
                  <div className="form-group">
                    <label htmlFor="username" className="input-label">
                      Your Name
                    </label>
                    <input
                      ref={inputRef}
                      type="text"
                      id="username"
                      placeholder="Enter your name"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      required
                      className="name-input"
                      aria-describedby="nameHelp"
                      autoComplete="off"
                      maxLength={20}
                    />
                    <small id="nameHelp" className="input-help">
                      This name will be visible to others (max 20 chars)
                    </small>
                  </div>

                  <button type="submit" className="submit-button">
                    <span>Join Chat</span>
                    <svg className="arrow-icon" viewBox="0 0 24 24">
                      <path d="M4 11v2h12l-5.5 5.5 1.42 1.42L19.84 12l-7.92-7.92L10.5 5.5 16 11H4z" />
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat interface */}
      {!showNameModal && (
        <div className="chat-container">
          {/* Chat header */}
          <div className="chat-header">
            <h2 className="chat-title">
              Welcome,{" "}
              <span
                style={{ color: getUsernameColor(displayName || userName) }}
              >
                {displayName || userName}
              </span>{" "}
              👋
            </h2>
            <div className="theme-leave">
              <div className="theme-toggle">
                <ThemeToggle />
              </div>
              <button className="leave-button" onClick={handleLeaveChat}>
                <i className="bi bi-box-arrow-right"></i> Leave
              </button>
            </div>
          </div>

          {/* Messages container */}
          <div
            ref={chatBoxRef}
            className="message-container"
            style={{ backgroundColor: "var(--bg)" }}
          >
            {messages.map((msg, index) => (
              <MessageBubble
                key={`${index}-${msg.time}`}
                msg={msg}
                userName={userName}
              />
            ))}
          </div>

          {/* Typing indicator */}
          {typingUser && typingUser !== (displayName || userName) && (
            <TypingIndicator typingUser={typingUser} />
          )}

          {/* Message input */}
          <form className="message-form" onSubmit={sendMessage}>
            <div className="message-input-container" ref={emojiPickerRef}>
              <input
                ref={inputRef}
                type="text"
                className="message-input"
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleTyping}
                onKeyUp={handleStopTyping}
                autoFocus
              />
              <button
                type="button"
                className={`emoji-button ${showEmojiPicker ? "active" : ""}`}
                onClick={toggleEmojiPicker}
                aria-label="Toggle emoji picker"
              >
                <i className="bi bi-emoji-smile"></i>
              </button>

              {showEmojiPicker && (
                <div className="emoji-picker-wrapper">
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    height={350}
                    previewConfig={{ showPreview: false }}
                    searchDisabled={false}
                    skinTonesDisabled
                    lazyLoadEmojis
                    style={{
                      backgroundColor: "var(--bgbubble)",
                    }}
                  />
                </div>
              )}
            </div>
            <button
              type="submit"
              className="send-button"
              disabled={!message.trim()}
              aria-label="Send message"
            >
              <i className="bi bi-send-fill"></i>
            </button>
          </form>
        </div>
      )}

      {/* Toast notifications */}
      <ToastContainer
        position="top-right"
        autoClose={2000}
        pauseOnHover
        theme="colored"
      />

      {/* Leave confirmation modal */}
      {showLeaveModal && (
        <ConfirmationModal
          title="Leave Chat?"
          subtitle="This action cannot be undone"
          onConfirm={confirmLeaveChat}
          onCancel={cancelLeaveChat}
          confirmText="Leave Chat"
          cancelText="Cancel"
          danger
        />
      )}
    </div>
  );
}

function MessageBubble({ msg, userName }) {
  const displayName = msg.displayName || msg.username;
  const isCurrentUser = msg.username === userName;
  const isSystem = msg.username === "System";

  const usernameColor = isCurrentUser
    ? "var(--primary)"
    : isSystem
    ? "var(--system-color)"
    : getUsernameColor(displayName);

  return (
    <div
      className={`message-wrapper ${
        isCurrentUser ? "message-right" : "message-left"
      }`}
    >
      <div className="message-content">
        {isSystem ? (
          <div className="system-message-divider">
            <div className="divider-line"></div>
            <span>System</span>
            <div className="divider-line"></div>
          </div>
        ) : null}

        <div
          className={`message-bubble ${
            isCurrentUser
              ? "user-message"
              : isSystem
              ? "system-message"
              : "other-message"
          }`}
        >
          {isSystem ? (
            <div className="system-message-text">{msg.text}</div>
          ) : (
            <>
              {!isCurrentUser && (
                <div className="message-user-info">
                  <div
                    className="user-avatar"
                    style={{ backgroundColor: usernameColor }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <span
                    className="username-text"
                    style={{ color: usernameColor }}
                  >
                    {displayName}
                  </span>
                </div>
              )}
              <div className="message-text">{msg.text}</div>
              <div className="message-meta">
                <span className="message-time">{msg.time}</span>
                {isCurrentUser && (
                  <span className="message-status">
                    <i className="bi bi-check2-all"></i>
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator({ typingUser }) {
  return (
    <div className="typing-indicator">
      <div className="typing-dots">
        <div className="typing-dot"></div>
        <div className="typing-dot middle"></div>
        <div className="typing-dot"></div>
      </div>
      <span>{typingUser} is typing</span>
    </div>
  );
}

function ConfirmationModal({
  title,
  subtitle,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  danger = false,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className={`modal-content ${danger ? "danger" : ""}`}>
          <header className="modal-header">
            <h2 className="modal-title">{title}</h2>
            <p className="modal-subtitle">{subtitle}</p>
            <button
              type="button"
              className="close-button"
              onClick={onCancel}
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" className="close-icon">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
              </svg>
            </button>
          </header>

          <div className="modal-body">
            <div className="action-buttons">
              <button
                type="button"
                className="confirm-button"
                onClick={onConfirm}
              >
                <span>{confirmText}</span>
                <svg className="exit-icon" viewBox="0 0 24 24">
                  <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
                </svg>
              </button>

              <button
                type="button"
                className="cancel-button"
                onClick={onCancel}
              >
                {cancelText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

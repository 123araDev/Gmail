const room = new WebsimSocket();
const specialUsers = ['Trey6383', 'rob', 'kat', 'sean', 'grog'];

function App() {
  const [emails, setEmails] = React.useState([]);
  const [showCompose, setShowCompose] = React.useState(false);
  const [selectedFolder, setSelectedFolder] = React.useState('inbox');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [users, setUsers] = React.useState([]);
  const [selectedEmail, setSelectedEmail] = React.useState(null);

  React.useEffect(() => {
    room.collection('email').subscribe((updatedEmails) => {
      const filteredEmails = updatedEmails
        .filter(email => {
          const isCurrentUser = email.sender === room.party.client.username;
          const isRecipient = email.recipient === room.party.client.username;
          
          if (!isCurrentUser && !isRecipient) {
            return false;
          }

          switch(selectedFolder) {
            case 'inbox':
              return isRecipient;
            case 'sent':
              return isCurrentUser;
            case 'starred':
              return email.starred && (isCurrentUser || isRecipient);
            default:
              return isCurrentUser || isRecipient;
          }
        })
        .filter(email => {
          if (!searchQuery) return true;
          const query = searchQuery.toLowerCase();
          return email.subject.toLowerCase().includes(query) || 
                 email.content.toLowerCase().includes(query) ||
                 email.sender.toLowerCase().includes(query);
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setEmails(filteredEmails);
    });
  }, [selectedFolder, searchQuery]);

  React.useEffect(() => {
    const updateUsers = () => {
      const onlineUsers = Object.values(room.party.peers).map(peer => peer.username);
      const allUsers = new Set([...specialUsers, ...onlineUsers]);
      setUsers(Array.from(allUsers));
    };
    updateUsers();
    room.party.subscribe(updateUsers);
  }, []);

  const handleSend = async (data) => {
    const isSpecialUser = specialUsers.includes(data.to);
    const isOnlineUser = Object.values(room.party.peers).some(peer => peer.username === data.to);
    const isSelfUser = data.to === room.party.client.username;
    
    if (!isSpecialUser && !isOnlineUser && !isSelfUser) {
      alert(`Cannot find user "${data.to}". Please check the username and try again.`);
      return;
    }

    const imageUrls = [];
    if (data.images && data.images.length > 0) {
      for (const file of data.images) {
        try {
          const url = await websim.upload(file);
          imageUrls.push(url);
        } catch (error) {
          console.error('Error uploading image:', error);
          alert('Failed to upload image. Please try again.');
          return;
        }
      }
    }

    await room.collection('email').create({
      sender: room.party.client.username,
      recipient: data.to,
      subject: data.subject,
      content: data.content,
      images: imageUrls,
      read: false,
      starred: false,
      created_at: new Date().toISOString(),
      replyTo: data.replyTo || null,
      originalContent: data.originalContent || null
    });
    setShowCompose(false);
  };

  const toggleRead = async (emailId, read) => {
    await room.collection('email').update(emailId, { read });
  };

  const toggleStarred = async (emailId, starred) => {
    await room.collection('email').update(emailId, { starred });
  };

  const handleReply = (email) => {
    setShowCompose(true);
    const replyData = {
      to: email.sender,
      subject: `Re: ${email.subject}`,
      replyTo: email.id,
      originalContent: `

On ${moment(email.created_at).format('MMM D, YYYY')} at ${moment(email.created_at).format('h:mm A')}, ${email.sender} wrote:
${email.content.split('\n').map(line => `> ${line}`).join('\n')}`
    };
    setComposeData(replyData);
  };

  const [composeData, setComposeData] = React.useState(null);

  return (
    <div className="app">
      <Header onSearch={setSearchQuery} />
      <Sidebar 
        selectedFolder={selectedFolder} 
        onFolderSelect={(folder) => {
          setSelectedFolder(folder);
          setSelectedEmail(null);
        }}
        onCompose={() => {
          setShowCompose(true);
          setComposeData(null);
        }}
        emails={emails}
      />
      <Main 
        emails={emails} 
        onToggleRead={toggleRead}
        onToggleStarred={toggleStarred}
        selectedEmail={selectedEmail}
        onSelectEmail={setSelectedEmail}
        onReply={handleReply}
      />
      {showCompose && (
        <ComposeModal 
          onClose={() => {
            setShowCompose(false);
            setComposeData(null);
          }}
          onSend={handleSend}
          users={users}
          initialData={composeData}
        />
      )}
    </div>
  );
}

function Header({ onSearch }) {
  const [searchValue, setSearchValue] = React.useState('');

  const handleSearch = (e) => {
    setSearchValue(e.target.value);
    onSearch(e.target.value);
  };

  return (
    <header className="header">
      <div className="logo">
        <img src="https://ssl.gstatic.com/ui/v1/icons/mail/rfr/logo_gmail_lockup_default_2x_r5.png" alt="Gmail" />
      </div>
      <div className="search">
        <span className="material-icons">search</span>
        <input 
          type="text" 
          placeholder="Search mail" 
          value={searchValue}
          onChange={handleSearch}
        />
      </div>
      <div className="header-right">
        <span className="material-icons">help_outline</span>
        <span className="material-icons">settings</span>
        <span className="material-icons">apps</span>
        <img 
          src={`https://images.websim.ai/avatar/${room.party.client.username}`}
          alt="Profile"
          className="avatar"
        />
      </div>
    </header>
  );
}

function Sidebar({ selectedFolder, onFolderSelect, onCompose, emails }) {
  const unreadCount = emails.filter(e => !e.read && e.recipient === room.party.client.username).length;
  const starredCount = emails.filter(e => e.starred).length;

  return (
    <div className="sidebar">
      <button className="compose-btn" onClick={onCompose}>
        <span className="material-icons">edit</span>
        Compose
      </button>
      <div 
        className={`nav-item ${selectedFolder === 'inbox' ? 'active' : ''}`}
        onClick={() => onFolderSelect('inbox')}
      >
        <span className="material-icons">inbox</span>
        Inbox
        {unreadCount > 0 && <span className="count">{unreadCount}</span>}
      </div>
      <div 
        className={`nav-item ${selectedFolder === 'starred' ? 'active' : ''}`}
        onClick={() => onFolderSelect('starred')}
      >
        <span className="material-icons">star</span>
        Starred
        {starredCount > 0 && <span className="count">{starredCount}</span>}
      </div>
      <div 
        className={`nav-item ${selectedFolder === 'sent' ? 'active' : ''}`}
        onClick={() => onFolderSelect('sent')}
      >
        <span className="material-icons">send</span>
        Sent
      </div>
    </div>
  );
}

function Main({ emails, onToggleRead, onToggleStarred, selectedEmail, onSelectEmail, onReply }) {
  const [selectedEmails, setSelectedEmails] = React.useState(new Set());
  
  const toggleSelectAll = () => {
    if (selectedEmails.size === emails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.map(e => e.id)));
    }
  };

  if (selectedEmail) {
    return (
      <EmailView 
        email={selectedEmail} 
        onBack={() => onSelectEmail(null)}
        onReply={onReply}
        onToggleStarred={onToggleStarred}
      />
    );
  }

  return (
    <main className="main">
      <div className="toolbar">
        <span 
          className="material-icons"
          onClick={toggleSelectAll}
        >
          {selectedEmails.size === emails.length ? 'check_box' : 'check_box_outline_blank'}
        </span>
        <span className="material-icons">refresh</span>
        <span className="material-icons">more_vert</span>
      </div>
      <ul className="email-list">
        {emails.map(email => (
          <EmailItem 
            key={email.id} 
            email={email}
            selected={selectedEmails.has(email.id)}
            onSelect={(selected) => {
              const newSelected = new Set(selectedEmails);
              if (selected) {
                newSelected.add(email.id);
              } else {
                newSelected.delete(email.id);
              }
              setSelectedEmails(newSelected);
            }}
            onToggleRead={onToggleRead}
            onToggleStarred={onToggleStarred}
            onClick={() => onSelectEmail(email)}
          />
        ))}
      </ul>
    </main>
  );
}

function EmailView({ email, onBack, onReply, onToggleStarred }) {
  const canView = React.useMemo(() => {
    const isCurrentUser = email.sender === room.party.client.username;
    const isRecipient = email.recipient === room.party.client.username;
    return isCurrentUser || isRecipient;
  }, [email]);

  if (!canView) {
    return (
      <div className="email-view">
        <div className="email-view-toolbar">
          <span className="material-icons" onClick={onBack}>arrow_back</span>
        </div>
        <div className="email-view-content">
          <div className="email-error">
            <span className="material-icons error-icon">error_outline</span>
            <p>You don't have permission to view this message.</p>
            <p>Emails can only be viewed by their sender and recipient.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="email-view">
      <div className="email-view-toolbar">
        <span className="material-icons" onClick={onBack}>arrow_back</span>
        <span className="material-icons">archive</span>
        <span className="material-icons">report_spam</span>
        <span className="material-icons">delete</span>
        <span className="material-icons">mark_email_unread</span>
        <span className="material-icons">access_time</span>
        <span className="material-icons">add_task</span>
        <span className="material-icons">drive_file_move</span>
        <span className="material-icons">label</span>
        <span className="material-icons">more_vert</span>
      </div>
      <div className="email-view-content">
        <div className="email-view-header">
          <h2>{email.subject}</h2>
          <div className="email-view-meta">
            <div className="email-view-sender">
              <img 
                src={`https://images.websim.ai/avatar/${email.sender}`}
                alt={email.sender}
                className="sender-avatar"
              />
              <div className="sender-info">
                <div className="sender-name">{email.sender}</div>
                <div className="sender-address">{`<${email.sender}>`}</div>
              </div>
            </div>
            <div className="email-view-date">
              {moment(email.created_at).format('MMM D, YYYY, h:mm A')}
              <span 
                className="material-icons star-button"
                onClick={() => onToggleStarred(email.id, !email.starred)}
              >
                {email.starred ? 'star' : 'star_border'}
              </span>
            </div>
          </div>
          {email.replyTo && (
            <div className="email-view-reply-info">
              in reply to previous message
            </div>
          )}
        </div>
        <div className="email-view-body">
          {email.content.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          {email.images && email.images.length > 0 && (
            <div className="email-images">
              {email.images.map((url, i) => (
                <img 
                  key={i}
                  src={url}
                  alt={`Attachment ${i + 1}`}
                  className="email-attachment-image"
                  onClick={() => window.open(url, '_blank')}
                />
              ))}
            </div>
          )}
          {email.originalContent && (
            <div className="email-view-quoted">
              {email.originalContent.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}
        </div>
        <div className="email-view-actions">
          <button className="reply-button" onClick={() => onReply(email)}>
            <span className="material-icons">reply</span>
            Reply
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailItem({ email, selected, onSelect, onToggleRead, onToggleStarred, onClick }) {
  const canView = React.useMemo(() => {
    const isCurrentUser = email.sender === room.party.client.username;
    const isRecipient = email.recipient === room.party.client.username;
    return isCurrentUser || isRecipient;
  }, [email]);

  if (!canView) {
    return null; 
  }

  const handleClick = () => {
    if (!email.read && email.recipient === room.party.client.username) {
      onToggleRead(email.id, true);
    }
    onClick();
  };

  return (
    <li className={`email-item ${!email.read ? 'unread' : ''} ${selected ? 'selected' : ''}`}>
      <div className="email-checkbox" onClick={(e) => {
        e.stopPropagation();
        onSelect(!selected);
      }}>
        <span className="material-icons">
          {selected ? 'check_box' : 'check_box_outline_blank'}
        </span>
      </div>
      <div className="email-star" onClick={(e) => {
        e.stopPropagation();
        onToggleStarred(email.id, !email.starred);
      }}>
        <span className="material-icons">
          {email.starred ? 'star' : 'star_border'}
        </span>
      </div>
      <div className="email-content" onClick={handleClick}>
        <div className="email-sender">
          <img 
            src={`https://images.websim.ai/avatar/${email.sender}`}
            alt={email.sender}
            className="sender-avatar"
          />
          {email.sender}
        </div>
        <div className="email-subject">
          {email.subject}
          {email.images && email.images.length > 0 && (
            <span className="material-icons attachment-icon">image</span>
          )}
        </div>
        <div className="email-snippet"> - {email.content}</div>
      </div>
      <div className="email-date">
        {moment(email.created_at).format('MMM D')}
      </div>
    </li>
  );
}

function ComposeModal({ onClose, onSend, users, initialData }) {
  const [to, setTo] = React.useState(initialData?.to || '');
  const [subject, setSubject] = React.useState(initialData?.subject || '');
  const [content, setContent] = React.useState('');
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [images, setImages] = React.useState([]);
  const fileInputRef = React.useRef(null);

  React.useEffect(() => {
    if (initialData?.originalContent) {
      setContent('\n\n' + initialData.originalContent);
      const textArea = document.querySelector('.compose-content');
      if (textArea) {
        textArea.focus();
        textArea.setSelectionRange(0, 0);
      }
    }
  }, [initialData]);

  const suggestions = React.useMemo(() => {
    if (!to) {
      return specialUsers.map(user => ({
        username: user,
        isSpecial: true,
        isOnline: Object.values(room.party.peers).some(peer => peer.username === user)
      }));
    }
    
    const query = to.toLowerCase();
    const matches = new Map();

    specialUsers.forEach(user => {
      if (user.toLowerCase().includes(query)) {
        matches.set(user, {
          username: user,
          isSpecial: true,
          isOnline: Object.values(room.party.peers).some(peer => peer.username === user)
        });
      }
    });

    if (query.length >= 2) {
      users.forEach(user => {
        if (user.toLowerCase().includes(query) && !matches.has(user)) {
          matches.set(user, {
            username: user,
            isSpecial: false,
            isOnline: true
          });
        }
      });
    }

    return Array.from(matches.values()).filter(user => user.username !== to);
  }, [to, users]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSend({ 
      to, 
      subject, 
      content,
      images,
      replyTo: initialData?.replyTo,
      originalContent: initialData?.originalContent
    });
  };

  const suggestionRef = React.useRef(null);
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAttachImage = async (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => 
      file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024
    );

    if (validFiles.length !== files.length) {
      alert('Please only select image files under 5MB');
    }

    setImages(prev => [...prev, ...validFiles]);
    fileInputRef.current.value = ''; // Reset input
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="compose-modal">
      <div className="compose-header">
        <div className="compose-title">New Message</div>
        <div className="compose-header-actions">
          <span className="material-icons">minimize</span>
          <span className="material-icons">open_in_full</span>
          <span className="material-icons" onClick={onClose}>close</span>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="compose-body">
        <div className="compose-field">
          <label>To</label>
          <div className="autocomplete" ref={suggestionRef}>
            <input 
              type="text" 
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              required
              placeholder="Enter username"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="suggestions">
                {suggestions.map(({username, isSpecial, isOnline}) => (
                  <li 
                    key={username}
                    onClick={() => {
                      setTo(username);
                      setShowSuggestions(false);
                    }}
                  >
                    <img 
                      src={`https://images.websim.ai/avatar/${username}`}
                      alt={username}
                      className="suggestion-avatar"
                    />
                    <span className="suggestion-username">{username}</span>
                    {isSpecial && 
                      <span className="special-user" title="Special User">★</span>
                    }
                    <span className={`user-status ${isOnline ? 'online' : 'offline'}`}>
                      {isOnline ? '●' : '○'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="compose-field">
          <label>Subject</label>
          <input 
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <textarea 
          className="compose-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
        {images.length > 0 && (
          <div className="image-previews">
            {images.map((file, index) => (
              <div key={index} className="image-preview">
                <img src={URL.createObjectURL(file)} alt={`Preview ${index + 1}`} />
                <button 
                  type="button" 
                  className="remove-image"
                  onClick={() => removeImage(index)}
                >
                  <span className="material-icons">close</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </form>
      <div className="compose-footer">
        <button className="send-btn" onClick={handleSubmit}>Send</button>
        <div className="compose-footer-actions">
          <input
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleAttachImage}
            ref={fileInputRef}
          />
          <span className="material-icons">format_bold</span>
          <span className="material-icons">format_italic</span>
          <span className="material-icons">link</span>
          <span 
            className="material-icons"
            onClick={() => fileInputRef.current.click()}
          >
            image
          </span>
          <span className="material-icons">insert_emoticon</span>
          <span className="material-icons">insert_drive_file</span>
          <span className="material-icons">delete</span>
        </div>
      </div>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
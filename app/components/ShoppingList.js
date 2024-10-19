"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ShoppingList() {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [language, setLanguage] = useState("ml-IN");  // Changed default to Malayalam
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const editInputRef = useRef(null);
  const [darkMode, setDarkMode] = useState(false);
  const [session, setSession] = useState(null);
  const [hasAccess, setHasAccess] = useState(null);
  const [userName, setUserName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSessionAndPermissions = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session) {
        await checkUserPermission(session.user.id);
        await saveUserProfile(session.user);
      }
      
      setIsLoading(false);
    };

    checkSessionAndPermissions();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setIsLoading(true);
      
      if (session) {
        await checkUserPermission(session.user.id);
        await saveUserProfile(session.user);
      } else {
        setHasAccess(null);
        setUserName("");
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchItems();
    const channel = supabase
      .channel('shopping_list_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list' }, payload => {
        console.log('Change received!', payload);
        fetchItems();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if ("webkitSpeechRecognition" in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.lang = language;

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setNewItem(transcript);
        addItem(transcript);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      if (isListening) {
        recognition.start();
      }

      return () => {
        recognition.stop();
      };
    }
  }, [isListening, language]);

  useEffect(() => {
    // Check for user's preference in localStorage
    const savedMode = localStorage.getItem('darkMode');
    setDarkMode(savedMode === 'true');
  }, []);

  useEffect(() => {
    // Update body class and localStorage when darkMode changes
    document.body.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const checkUserPermission = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('has_access')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data === null) {
        console.log('No permission record found for user. Creating one...');
        await createUserPermission(userId);
      } else {
        setHasAccess(data.has_access || false);
      }
    } catch (error) {
      console.error('Error checking user permission:', error);
      setHasAccess(false);
    }
  };

  const createUserPermission = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .insert({ user_id: userId, has_access: false })
        .select()
        .single();

      if (error) throw error;

      setHasAccess(data.has_access);
    } catch (error) {
      console.error('Error creating user permission:', error);
      setHasAccess(false);
    }
  };

  const saveUserProfile = async (user) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        full_name: user.user_metadata.full_name,
        email: user.email
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving user profile:', error);
    } else {
      setUserName(data.full_name);
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: process.env.NEXT_PUBLIC_REDIRECT_URL
      }
    });
    if (error) console.error('Error signing in with Google:', error);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error signing out:', error);
    setUserName("");
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const fetchItems = async () => {
    let { data, error } = await supabase
      .from('shopping_list_with_users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching items:', error);
    } else {
      // Deduplicate items based on id
      const uniqueItems = Array.from(new Map(data.map(item => [item.id, item])).values());
      setItems(uniqueItems);
    }
  };

  const addItem = async (item) => {
    if (item.trim() !== "") {
      const { data, error } = await supabase
        .from('shopping_list')
        .insert([{ 
          text: item.trim(), 
          completed: false,
          created_by: session.user.id  // Add this line
        }]);
      
      if (error) console.log('error', error);
      else {
        setNewItem("");
        fetchItems();
      }
    }
  };

  const deleteItem = async (id) => {
    const { error } = await supabase
      .from('shopping_list')
      .delete()
      .eq('id', id);
    
    if (error) console.log('error', error);
    else fetchItems();
  };

  const toggleItemCompletion = async (id, completed) => {
    const { error } = await supabase
      .from('shopping_list')
      .update({ completed: !completed })
      .eq('id', id);
    
    if (error) console.log('error', error);
    else fetchItems();
  };

  const formatDate = (dateString) => {
    const options = { 
      year: '2-digit', 
      month: '2-digit', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(language === "en-US" ? 'en-US' : 'ml-IN', options);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    addItem(newItem);
  };

  const toggleListening = () => {
    setIsListening(!isListening);
  };

  const toggleLanguage = () => {
    setLanguage(language === "en-US" ? "ml-IN" : "en-US");
  };

  const deleteAllItems = async () => {
    const { error } = await supabase
      .from('shopping_list')
      .delete()
      .not('id', 'is', null); // This deletes all rows
    
    if (error) console.log('error', error);
    else {
      fetchItems();
      setShowDeleteConfirmation(false);
    }
  };

  const startEditing = (item) => {
    setEditingId(item.id);
    setEditText(item.text);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = async () => {
    if (editText.trim() !== "") {
      const { error } = await supabase
        .from('shopping_list')
        .update({ text: editText.trim() })
        .eq('id', editingId);
      
      if (error) console.log('error', error);
      else {
        setEditingId(null);
        setEditText("");
        fetchItems();
      }
    }
  };

  const editItem = async (id, newText) => {
    const { error } = await supabase
      .from('shopping_list')
      .update({ text: newText })
      .eq('id', id);
    
    if (error) console.log('error', error);
    else {
      setEditingId(null);
      setEditText("");
      fetchItems();
    }
  };

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center h-screen bg-white dark:bg-gray-800">
        <div className="loader"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex w-full items-center justify-center h-screen bg-white dark:bg-gray-800">
        <button
          onClick={signInWithGoogle}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition duration-200"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  if (hasAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-gray-800 text-black dark:text-white">
        <p className="mb-4">You dont have permission to access this app.</p>
        <button
          onClick={signOut}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition duration-200"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className={`w-full flex flex-col h-screen ${darkMode ? 'dark' : ''} font-malayalam`}>
      <header className="sticky top-0 bg-white dark:bg-gray-800 text-black dark:text-white p-4 border-b border-gray-300 dark:border-gray-600 z-10">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">ഷോപ്പിംഗ് ലിസ്റ്റ്</h2>
          <div className="flex items-center">
            <span className="mr-4">{userName}</span>
            <button
              onClick={toggleDarkMode}
              className="bg-gray-200 dark:bg-gray-600 text-black dark:text-white p-2 rounded mr-2"
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button
              onClick={signOut}
              className="bg-red-500 hover:bg-red-600 text-white p-2 rounded transition duration-200"
              aria-label="Sign Out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-grow overflow-y-auto bg-white dark:bg-gray-800 text-black dark:text-white p-4">
        {items.length > 0 ? (
          <>
            <div className="mb-4">
              <button
                onClick={() => setShowDeleteConfirmation(true)}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition duration-200"
              >
                {language === "en-US" ? "Delete All" : "എല്ലാം നീക്കം ചെയ്യുക"}
              </button>
            </div>

            <ul className="list-none pl-0">
              {items.map((item) => (
                <li key={item.id} className="flex flex-col mb-2 p-2 rounded border-2 border-gray-300 dark:border-gray-600">
                  <div className="flex justify-between items-center">
                    {editingId === item.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit();
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        className="flex-grow mr-0 p-1 border rounded text-slate-950"
                      />
                    ) : (
                      <div 
                        className="flex items-center flex-grow cursor-pointer"
                        onClick={() => toggleItemCompletion(item.id, item.completed)}
                      >
                        <div className="relative w-6 h-6 mr-2 flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => toggleItemCompletion(item.id, item.completed)}
                            className="absolute w-6 h-6 opacity-0 cursor-pointer"
                          />
                          <div className={`w-6 h-6 border-2 rounded-md ${item.completed ? 'bg-blue-500 border-blue-500' : 'border-gray-400 dark:border-gray-500'}`}>
                            {item.completed && (
                              <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </div>
                        <span className={`${item.completed ? "line-through" : ""} flex-grow`}>
                          {item.text}
                        </span>
                      </div>
                    )}
                    <div className="flex">
                      {editingId === item.id ? (
                        <>
                          <button
                            onClick={saveEdit}
                            className="text-green-500 hover:text-green-700 p-1 mr-1"
                            aria-label={language === "en-US" ? "Save" : "സേവ് ചെയ്യുക"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="text-gray-500 hover:text-gray-700 p-1"
                            aria-label={language === "en-US" ? "Cancel" : "റദ്ദാക്കുക"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditing(item)}
                            className="text-blue-500 hover:text-blue-700 p-1 mr-1"
                            aria-label={language === "en-US" ? "Edit" : "തിരുത്തുക"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            aria-label={language === "en-US" ? "Delete" : "നീക്കം ചെയ്യുക"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {/* {language === "en-US" ? "Added: " : "ചേർത്തത്: "} */}
                    {formatDate(item.created_at)}
                    {item.creator_name && (
                      <span className="ml-2">
                        {/* {language === "en-US" ? "by " : "ആരാൽ "} */}
                        {item.creator_name}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <svg className="w-24 h-24 text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              {language === "en-US" 
                ? "Your shopping basket is empty" 
                : "നിങ്ങളുടെ ഷോപ്പിംഗ് കർട്ട് ശൂന്യമാണ്"}
            </p>
          </div>
        )}

        {showDeleteConfirmation && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-xl max-w-sm w-full">
              <p className="mb-4 text-black dark:text-white">
                {language === "en-US" 
                  ? "Are you sure you want to delete all items?" 
                  : "എല്ലാ ഇനങ്ങളും നീക്കം ചെയ്യണമെന്ന് തീർച്ചയാണോ?"}
              </p>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowDeleteConfirmation(false)}
                  className="bg-gray-300 dark:bg-gray-600 text-black dark:text-white px-4 py-2 rounded hover:bg-gray-400 dark:hover:bg-gray-500 transition duration-200"
                >
                  {language === "en-US" ? "No" : "ഇല്ല"}
                </button>
                <button
                  onClick={deleteAllItems}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition duration-200"
                >
                  {language === "en-US" ? "Yes" : "അതെ"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-white dark:bg-gray-800 p-4 border-t border-gray-300 dark:border-gray-600">
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={language === "en-US" ? "Add an item" : "ഒരു ഇനം ചേർക്കുക"}
            className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-black dark:text-white"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={toggleLanguage}
              className="bg-purple-500 mr-auto text-white px-4 py-2 rounded flex items-center"
              aria-label={language === "en-US" ? "Switch to Malayalam" : "Switch to English"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.724 4.78c.29.354.596.696.914 1.026a1 1 0 11-1.44 1.389c-.188-.196-.373-.396-.554-.6a19.098 19.098 0 01-3.107 3.567 1 1 0 01-1.334-1.49 17.087 17.087 0 003.13-3.733 18.992 18.992 0 01-1.487-2.494 1 1 0 111.79-.89c.234.47.489.928.764 1.372.417-.934.752-1.913.997-2.927H3a1 1 0 110-2h3V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.869.869 0 01.02.037l.99 1.98a1 1 0 11-1.79.895L15.383 16h-4.764l-.724 1.447a1 1 0 11-1.788-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z" clipRule="evenodd" />
              </svg>
              <span className="w-6">{language === "en-US" ? "മ" : "En"}</span>
            </button>
            <button 
              type="submit" 
              className="bg-blue-500 text-white px-4 py-2 rounded flex items-center"
              aria-label={language === "en-US" ? "Add Item" : "ഇനം ചേർക്കുക"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              type="button"
              onClick={toggleListening}
              className={`px-4 py-2 rounded flex items-center ${
                isListening ? "bg-red-500 text-white" : "bg-green-500 text-white"
              }`}
              aria-label={isListening 
                ? (language === "en-US" ? "Stop Listening" : "കേൾക്കുന്നത് നിർത്തുക")
                : (language === "en-US" ? "Start Voice Input" : "വോയ്‌സ് ഇൻപുട്ട് ആരംഭിക്കുക")}
            >
              {isListening ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            
          </div>
        </form>
      </div>
    </div>
  );
}
import React, { useState, useMemo, useRef, useEffect } from 'react';
import Login from './Login.jsx';
import Register from './Register.jsx';
import { supabase } from './supabaseClient.js';

// GROQ API Configuration
const GROQ_API_KEY = "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";
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Utility Functions
const calculateBMI = (weight, height) => {
  if (height <= 0 || weight <= 0) return 0;
  const heightInMeters = height / 100;
  return (weight / (heightInMeters * heightInMeters));
};

async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({ error: 'Unknown server error' }));
        throw new Error(errorJson.error?.message || response.statusText);
      }
      return response;
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error("Fetch failed after max retries:", error);
        throw error;
      }
      const delay = Math.pow(2, i) * 1000 + (Math.random() * 1000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

const initialProfile = {
  name: '',
  age: '',
  gender: 'Male',
  height: '',
  currentWeight: '',
  targetWeight: '',
  fitnessGoal: 'Weight Loss',
  activityLevel: 'Moderate',
  equipment: 'Dumbbells + Bodyweight',
};

const App = () => {
  const [profile, setProfile] = useState(initialProfile);
  const [page, setPage] = useState('landing'); 	// 'landing' | 'app' | 'login' | 'register'
  const [planData, setPlanData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  // Supabase Auth State
  const [session, setSession] = useState(null); 
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Chatbot states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: "Hi! 👋 I'm your AI fitness assistant. Ask me anything about workouts, exercises, nutrition, or fitness tips! 💪" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const channelRef = useRef(null);

  const currentBMI = useMemo(() => {
    const w = parseFloat(profile.currentWeight);
    const h = parseFloat(profile.height);
    if (isNaN(w) || isNaN(h)) return 0;
    return calculateBMI(w, h).toFixed(1);
  }, [profile.currentWeight, profile.height]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000); // Clear after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Supabase Auth and Profile Management
  useEffect(() => {
    setIsDataLoading(true);
    
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setIsDataLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setPage('app');
        fetchUserProfile(session.user.id);
        // Subscribe to real-time profile changes
        if (channelRef.current) {
          channelRef.current.unsubscribe();
        }
        channelRef.current = supabase
          .channel('profile_changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${session.user.id}` }, (payload) => {
            console.log('Real-time profile update:', payload);
            if (payload.eventType === 'UPDATE') {
              setProfile(prev => ({ 
                ...prev, 
                ...payload.new,
                // Convert numeric fields back to strings for inputs
                age: String(payload.new.age || ''), 
                height: String(payload.new.height || ''),
                currentWeight: String(payload.new.currentweight || ''),
                targetWeight: String(payload.new.targetweight || ''),
                fitnessGoal: payload.new.fitnessgoal || '',
                activityLevel: payload.new.activitylevel || '',
                equipment: payload.new.equipment || ''
              }));
              // Update planData if last_plan changed
              if (payload.new.last_plan) {
                setPlanData(payload.new.last_plan);
              }
            }
          })
          .subscribe();
      } else {
        setProfile(initialProfile);
        setPlanData(null);
        setPage('landing');
        setIsDataLoading(false);
        if (channelRef.current) {
          channelRef.current.unsubscribe();
          channelRef.current = null;
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId) => {
    setIsDataLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error.message);
      setError('Failed to load profile.');
    } else if (data) {
      setProfile(prev => ({ 
          ...initialProfile, 
          ...data,
          // Convert numeric fields back to strings for input fields
          age: String(data.age || ''), 
          height: String(data.height || ''),
          currentWeight: String(data.currentweight || ''),
          targetWeight: String(data.targetweight || ''),
          fitnessGoal: data.fitnessgoal || '',
          activityLevel: data.activitylevel || '',
          equipment: data.equipment || ''
      }));

      if (data.last_plan) {
        setPlanData(data.last_plan);
      }
    }
    setIsDataLoading(false);
  };

  const saveUserProfile = async (newProfile) => {
    if (!session?.user?.id) {
        setError("You must be logged in to save your profile.");
        return;
    }
    setIsLoading(true);
    
    const profileToSave = {
        user_id: session.user.id,
        name: newProfile.name,
        age: Number(newProfile.age) || null,
        gender: newProfile.gender,
        height: Number(newProfile.height) || null,
        currentweight: Number(newProfile.currentWeight) || null,
        targetweight: Number(newProfile.targetWeight) || null,
        fitnessgoal: newProfile.fitnessGoal,
        activitylevel: newProfile.activityLevel,
        equipment: newProfile.equipment,
        last_plan: planData || null, 
    };

    console.log('Saving profile:', profileToSave);

    const { error } = await supabase
      .from('profiles')
      .upsert(profileToSave, { onConflict: 'user_id' }); 

    if (error) {
      console.error('Error saving profile:', error);
      setError('Failed to save profile: ' + error.message);
    } else {
        setSuccessMessage("Profile saved successfully!");
        setError(null); // Clear any previous error
    }
    setIsLoading(false);
  };
  
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout Error:', error.message);
    }
    // Auth state change listener handles the rest of the state cleanup
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setProfile(prev => ({ ...prev, [id]: value }));
  };

  const generatePlan = async () => {
    setError(null);
    setPlanData(null);
    setIsLoading(true);

    if (!profile.currentWeight || !profile.height || !profile.targetWeight) {
        setError("Please enter your height, current weight, and target weight to generate a plan.");
        setIsLoading(false);
        return;
    }

    try {
      const weightDiff = Math.abs(parseFloat(profile.targetWeight) - parseFloat(profile.currentWeight));

      const prompt = `You are an expert fitness coach. Generate a personalized fitness plan.

User Profile:
- Name: ${profile.name}
- Age: ${profile.age}
- Gender: ${profile.gender}
- Height: ${profile.height} cm
- Current Weight: ${profile.currentWeight} kg
- Target Weight: ${profile.targetWeight} kg
- Weight Change Needed: ${weightDiff} kg
- BMI: ${currentBMI}
- Fitness Goal: ${profile.fitnessGoal}
- Activity Level: ${profile.activityLevel}
- Available Equipment: ${profile.equipment}

IMPORTANT INSTRUCTIONS:
1. Use EXACT numbers only (e.g., "5 min" NOT "5-7 minutes")
2. Keep ALL exercises in SHORT format
3. Each exercise should be: ExerciseName (sets×reps) or ExerciseName (duration)
4. Maximum 3-4 exercises per section

JSON format:
{
  "predicted_time": "exact time (e.g., '12 weeks')",
  "plan": {
    "warmUp": "Jumping Jacks (5 min), Arm Circles (2 min)",
    "strength": "Squats (3×12), Push-ups (3×10), Rows (3×12)",
    "cardio": "Running (20 min), Jump Rope (10 min)",
    "coolDown": "Static Stretching (5 min)"
  }
}

Keep it simple and concise. Use exact single numbers only.`;

      const payload = {
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a fitness coach. Always respond with valid JSON only. Be extremely concise. Use exact single numbers only - never use ranges. Keep all text very short and simple."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 2500,
        response_format: { type: "json_object" }
      };

      const response = await fetchWithRetry(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("API returned an invalid response structure.");
      }

      const parsedPlan = JSON.parse(content);

      const newPlanData = {
        ...parsedPlan,
        timestamp: new Date().toISOString()
      };

      setPlanData(newPlanData);
      
      // Save the plan and current profile after generation
      if (session?.user?.id) {
          // Pass the newly generated plan into the save function
          await saveUserProfile({...profile, last_plan: newPlanData}); 
          setSuccessMessage("Fitness plan generated and saved successfully!");
      }

    } catch (err) {
      console.error("Plan Generation Error:", err);
      setError(`Failed to generate plan: ${err.message}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const userContext = profile.name ? `
User Profile Context:
- Name: ${profile.name}
- Age: ${profile.age}
- Gender: ${profile.gender}
- Current Weight: ${profile.currentWeight} kg
- Target Weight: ${profile.targetWeight} kg
- Fitness Goal: ${profile.fitnessGoal}
- Activity Level: ${profile.activityLevel}
- Equipment: ${profile.equipment}
` : '';
    
    const planContext = planData ? `\nCURRENTLY GENERATED PLAN:\n${JSON.stringify(planData.plan)}\n` : '';


      const payload = {
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content: `You are an expert fitness coach and personal trainer specializing in workouts, exercises, nutrition, and health. 

IMPORTANT RULES:
1. ONLY answer questions related to: fitness, workouts, exercises, nutrition, diet, health, wellness, strength training, cardio, bodybuilding, weight loss, muscle gain, sports performance, injury prevention, recovery, and supplements.

2. If the user asks about ANYTHING else (weather, politics, general knowledge, entertainment, etc.), politely decline and redirect them back to fitness topics.

3. Keep responses concise (2-4 sentences), friendly, and encouraging. Use emojis occasionally to make it engaging.

4. If you detect an off-topic question, respond with: "I'm your fitness assistant and I specialize in workouts, nutrition, and health topics! 💪 Ask me about exercises, training tips, or nutrition advice instead!"

Provide helpful, accurate fitness advice based on current exercise science.
${userContext}
${planContext}`
          },
          // Send only the last few messages for context to stay within token limits
          ...chatMessages.slice(-5).filter(msg => msg.role !== 'system').map(msg => ({ role: msg.role, content: msg.content })),
          { role: "user", content: userMessage.content }
        ],
        temperature: 0.8,
        max_tokens: 500
      };

      const response = await fetchWithRetry(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;

      if (content) {
        setChatMessages(prev => [...prev, { role: 'assistant', content }]);
      }
    } catch (err) {
      console.error("Chat Error:", err);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again! 🔄'
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleChatKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  const OutputContent = () => {
    if (successMessage) {
      return (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-lg" role="alert">
          <p className="font-bold mb-1">Success!</p>
          <p className="text-sm">{successMessage}</p>
        </div>
      );
    }

    if (error && !planData) {
      return (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
          <p className="font-bold mb-1">Error/Message</p>
          <p className="text-sm">{error}</p>
        </div>
      );
    }

    if (!planData) {
      return (
        <div id="output-placeholder" className="text-indigo-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <h3 className="mt-4 text-xl font-semibold text-white">Your Plan Awaits</h3>
          <p className="mt-1 text-sm text-indigo-200">Fill in your profile and click generate to get your personalized AI workout plan.</p>
        </div>
      );
    }

    const plan = planData.plan;

    return (
      <div className="w-full text-left">
        <div className="mb-6 bg-purple-900/40 border-l-4 border-purple-400 p-4 rounded-r-lg shadow-md">
          <h3 className="text-sm font-semibold text-purple-200">Predicted Time to Achieve Target</h3>
          <p className="text-3xl font-extrabold text-purple-300 mt-1">~{planData.predicted_time}</p>
          <div className="mt-2 text-xs text-indigo-200">
            *Based on your current profile and goal.
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-4">Recommended Workout Plan</h2>

        <div className="space-y-3 text-white">
          {plan.warmUp && (
            <p className="leading-relaxed"><span className="font-semibold text-orange-300">Warm-up:</span> <span className="text-indigo-100">{plan.warmUp}</span></p>
          )}
          {plan.strength && (
            <p className="leading-relaxed"><span className="font-semibold text-red-300">Strength:</span> <span className="text-indigo-100">{plan.strength}</span></p>
          )}
          {plan.cardio && (
            <p className="leading-relaxed"><span className="font-semibold text-green-300">Cardio:</span> <span className="text-indigo-100">{plan.cardio}</span></p>
          )}
          {plan.coolDown && (
            <p className="leading-relaxed"><span className="font-semibold text-blue-300">Cooldown:</span> <span className="text-indigo-100">{plan.coolDown}</span></p>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-purple-400">
          <p className="text-xs text-indigo-200 flex items-center justify-between">
            <span>Powered by Groq AI</span>
            <span className="text-green-300 font-semibold">✓ Evidence-Based</span>
          </p>
        </div>
      </div>
    );
  };
    
  // Conditional UI rendering for auth/data loading
  if (isDataLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-indigo-700 to-purple-700">
            <div className="flex flex-col items-center">
                <div className="loader w-12 h-12 border-indigo-400 border-t-purple-300"></div>
                <p className="mt-4 text-xl text-white font-medium">Loading User Data...</p>
            </div>
        </div>
    );
  }

  // Conditional Navigation buttons based on session
  const AuthButtons = () => {
    if (session) {
      return (
        <div className="flex space-x-4">
            <button 
                onClick={() => setPage('app')} 
                className="px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow transition"
            >
                App
            </button>
            <button 
                onClick={handleLogout} 
                className="px-5 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold shadow transition"
            >
                Logout ({profile.name || 'User'})
            </button>
        </div>
      );
    }
    return (
      <nav className="space-x-4">
        <button onClick={() => setPage('login')} className="px-5 py-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow transition">Login</button>
        <button onClick={() => setPage('register')} className="px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow transition">Register</button>
      </nav>
    );
  };

  return (
    <div className="min-h-screen font-sans bg-gradient-to-br from-indigo-900 via-indigo-700 to-purple-700 text-gray-100">
      {/* Header */}
      <header className="w-full py-6 px-4 flex justify-between items-center bg-indigo-950 shadow-lg">
        <div 
            onClick={() => setPage('landing')} 
            className="cursor-pointer transition duration-300 hover:text-purple-300" 
            role="button"
        >
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-lg">
            AI Fitness Analyst
          </h1>
        </div>
        <AuthButtons /> 
      </header>

      {/* Landing Page with Background Image */}
      <div 
        className={`flex flex-col items-center justify-center min-h-[70vh] text-center p-6 transition-opacity duration-500 bg-cover bg-center bg-no-repeat relative ${page === 'landing' ? 'opacity-100 block' : 'opacity-0 hidden'}`}
        style={{
          backgroundImage: 'url("/pic.jpg")',
        }}
      >
        {/* Dark overlay for better text visibility */}
        <div className="absolute inset-0 bg-black/50"></div>
        
        <div className="max-w-3xl w-full relative z-10">
          <h2 className="text-5xl sm:text-7xl font-extrabold text-white tracking-tight mb-4 drop-shadow-2xl">
            AI FITNESS ANALYST
          </h2>
          <p className="text-white mt-4 text-lg sm:text-xl font-light leading-relaxed drop-shadow-xl">
            Your personalized companion for workout generation and goal prediction, <span className="font-semibold text-purple-300 drop-shadow-lg">powered by AI intelligence</span>.
          </p>
          <div className="mt-6 flex items-center justify-center space-x-2 text-sm">
            <span className="bg-green-400/30 text-green-100 px-3 py-1 rounded-full font-medium backdrop-blur-sm shadow-lg">Groq AI</span>
          </div>
          <button
            onClick={() => session ? setPage('app') : setPage('login')}
            className="mt-12 py-3 px-10 text-lg rounded-full font-bold text-white shadow-2xl transition duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center mx-auto bg-purple-600 hover:bg-purple-700"
          >
            Get Started
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Login Page - Pass supabase client */}
      <div className={`min-h-[70vh] p-6 transition-opacity duration-500 ${page === 'login' ? 'opacity-100 block' : 'opacity-0 hidden'}`}>
        <Login setPage={setPage} supabase={supabase} />
      </div>

      {/* Register Page - Pass supabase client */}
      <div className={`min-h-[70vh] p-6 transition-opacity duration-500 ${page === 'register' ? 'opacity-100 block' : 'opacity-0 hidden'}`}>
        <Register setPage={setPage} supabase={supabase} />
      </div>

      {/* Main App Page */}
      {session && (
        <div className={`min-h-[70vh] p-4 sm:p-8 transition-opacity duration-500 ${page === 'app' ? 'opacity-100 block' : 'opacity-0 hidden'}`}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-indigo-950/80 p-6 rounded-2xl shadow-2xl border border-indigo-900">
            <h2 className="text-2xl font-bold text-white mb-6">Your Fitness Profile</h2>
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Fields for name, age, gender, height, currentWeight, targetWeight */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-indigo-200">Name</label>
                  <input
                    type="text"
                    id="name"
                    value={profile.name}
                    onChange={handleInputChange}
                    placeholder="Enter your name"
                    className="mt-1 block w-full px-3 py-2 bg-indigo-900/60 border border-purple-400 rounded-lg text-sm shadow-sm placeholder-indigo-300 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label htmlFor="age" className="block text-sm font-medium text-indigo-200">Age</label>
                  <input
                    type="number"
                    id="age"
                    value={profile.age}
                    onChange={handleInputChange}
                    placeholder="Enter age"
                    className="mt-1 block w-full px-3 py-2 bg-indigo-900/60 border border-purple-400 rounded-lg text-sm shadow-sm placeholder-indigo-300 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-indigo-200">Gender</label>
                  <select
                    id="gender"
                    value={profile.gender}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 bg-indigo-900/60 border border-purple-400 rounded-lg text-sm shadow-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="height" className="block text-sm font-medium text-indigo-200">Height (cm)</label>
                  <input
                    type="number"
                    id="height"
                    value={profile.height}
                    onChange={handleInputChange}
                    placeholder="Enter height"
                    className="mt-1 block w-full px-3 py-2 bg-indigo-900/60 border border-purple-400 rounded-lg text-sm shadow-sm placeholder-indigo-300 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label htmlFor="currentWeight" className="block text-sm font-medium text-indigo-200">Current Weight (kg)</label>
                  <input
                    type="number"
                    id="currentWeight"
                    value={profile.currentWeight}
                    onChange={handleInputChange}
                    placeholder="Enter current weight"
                    className="mt-1 block w-full px-3 py-2 bg-indigo-900/60 border border-purple-400 rounded-lg text-sm shadow-sm placeholder-indigo-300 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label htmlFor="targetWeight" className="block text-sm font-medium text-indigo-200">Target Weight (kg)</label>
                  <input
                    type="number"
                    id="targetWeight"
                    value={profile.targetWeight}
                    onChange={handleInputChange}
                    placeholder="Enter target weight"
                    className="mt-1 block w-full px-3 py-2 bg-indigo-900/60 border border-purple-400 rounded-lg text-sm shadow-sm placeholder-indigo-300 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="mt-6 p-4 bg-indigo-900/60 border border-purple-400 rounded-xl text-center shadow-inner">
                <h3 className="text-sm font-medium text-indigo-200">Calculated BMI</h3>
                <p className={`text-4xl font-extrabold mt-1 transition-colors duration-300 ${currentBMI > 25 ? 'text-red-400' : currentBMI < 18.5 ? 'text-orange-400' : 'text-purple-300'}`}>
                  {currentBMI}
                </p>
              </div>

              <div className="mt-6 pt-6 border-t border-purple-400">
                <h3 className="text-xl font-bold text-white mb-4">Plan Preferences</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="fitnessGoal" className="block text-sm font-medium text-indigo-200">Fitness Goal</label>
                    <select
                      id="fitnessGoal"
                      value={profile.fitnessGoal}
                      onChange={handleInputChange}
                      className="mt-1 block w-full px-3 py-2 bg-indigo-900/60 border border-purple-400 rounded-lg text-sm shadow-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="Weight Loss">Weight Loss</option>
                      <option value="Muscle Gain">Muscle Gain</option>
                      <option value="Strength">Strength</option>
                      <option value="Endurance">Endurance</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="activityLevel" className="block text-sm font-medium text-indigo-200">Activity Level</label>
                    <select
                      id="activityLevel"
                      value={profile.activityLevel}
                      onChange={handleInputChange}
                      className="mt-1 block w-full px-3 py-2 bg-indigo-900/60 border border-purple-400 rounded-lg text-sm shadow-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="Sedentary">Sedentary</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Active">Active</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="equipment" className="block text-sm font-medium text-indigo-200">Equipment</label>
                    <select
                      id="equipment"
                      value={profile.equipment}
                      onChange={handleInputChange}
                      className="mt-1 block w-full px-3 py-2 bg-indigo-900/60 border border-purple-400 rounded-lg text-sm shadow-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="Dumbbells + Bodyweight">Dumbbells + Bodyweight</option>
                      <option value="Bodyweight">Bodyweight</option>
                      <option value="Cable Machine">Cable Machine</option>
                      <option value="Free Weights">Free Weights</option>
                      <option value="Resistance Bands">Resistance Bands</option>
                      <option value="Kettlebells">Kettlebells</option>
                      <option value="Barbell">Barbell</option>
                      <option value="Full Gym">Full Gym</option>
                      <option value="Home Equipment">Home Equipment</option>
                    </select>
                  </div>
                </div>
              </div>

              {session && (
                  <button
                    onClick={() => saveUserProfile(profile)}
                    disabled={isLoading}
                    className="w-full mt-8 bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-indigo-700 transition duration-300 shadow-lg disabled:bg-indigo-300 flex items-center justify-center"
                  >
                    {isLoading ? 'Saving...' : 'Save Profile'}
                  </button>
              )}

              <button
                onClick={generatePlan}
                disabled={isLoading}
                className="w-full mt-4 bg-purple-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-purple-700 transition duration-300 shadow-lg disabled:bg-purple-300 flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <div className="loader mr-3 border-indigo-400 border-t-purple-300 w-5 h-5"></div>
                    Generating Plan...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate AI Plan
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-indigo-950/80 p-6 rounded-2xl shadow-2xl border border-indigo-900 flex flex-col items-center justify-start">
            {isLoading && (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                <div className="loader w-12 h-12 border-indigo-400 border-t-purple-300"></div>
                <p className="mt-4 text-lg text-indigo-200 font-medium">Generating your personalized plan...</p>
                <p className="text-sm text-indigo-300 mt-2">Analyzing your profile with AI</p>
              </div>
            )}
            {!isLoading && <OutputContent />}
          </div>
        </div>
        </div>
      )}

      {/* Chatbot Button */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-full p-4 shadow-2xl transition-all duration-300 transform hover:scale-110 z-50"
      >
        {isChatOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chatbot Window */}
      <div className={`fixed bottom-24 right-6 w-96 h-[500px] bg-indigo-950 border-2 border-purple-500 rounded-2xl shadow-2xl transition-all duration-300 z-50 flex flex-col ${isChatOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
        {/* Chat Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-400 rounded-full mr-2 animate-pulse"></div>
            <h3 className="font-bold">AI Fitness Coach</h3>
          </div>
          <button onClick={() => setIsChatOpen(false)} className="hover:bg-purple-700 rounded-full p-1 transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-br from-indigo-900 to-indigo-950">
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'user' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white' : 'bg-indigo-800 text-gray-200'}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.role === 'assistant' && <p className="text-xs text-indigo-300 mt-1">Groq AI</p>}
              </div>
            </div>
          ))}
          {isChatLoading && (
            <div className="flex justify-start">
              <div className="bg-indigo-800 text-gray-200 p-3 rounded-lg">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t border-indigo-800 bg-indigo-950">
          <div className="flex space-x-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={handleChatKeyPress}
              placeholder="Ask about workouts..."
              className="flex-1 px-4 py-2 bg-indigo-900/60 border border-purple-400 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 placeholder-indigo-300"
              disabled={isChatLoading}
            />
            <button
              onClick={sendChatMessage}
              disabled={isChatLoading || !chatInput.trim()}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>

    {/* Footer - Added a footer to enclose the style block correctly */}
    <footer className="w-full py-6 px-4 bg-indigo-950 text-indigo-300 text-center mt-12 shadow-inner">
        <span className="font-semibold">© 2025 AI Fitness Analyst</span>
    </footer>
    
    {/* CSS Style Block */}
    <style>{`
        .loader {
            border: 4px solid #3730a3;
            border-top: 4px solid #a78bfa;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `}</style>

    </div>
  );
};

export default App;

# React 

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).


                                AI Fitness Analyst


The AI Fitness Analyst is a modern web application built with React and Tailwind CSS that utilizes the Groq API to generate tailored fitness plans and provide real-time coaching advice based on user profiles.


 # Personalized Profile: 
 Capture essential fitness metrics (Age, Gender, Height, Weight, Goals, Equipment). 
# BMI Calculation:
Automatic calculation and display of Body Mass Index. AI-Powered Plan Generation: Generates a structured workout plan (Warm-up, Strength, Cardio, Cooldown) 
 # Predicted timeline: 
 to reach the target weight, all within a constrained JSON format.
 # AI Fitness Chatbot:
 A friendly, context-aware chatbot for real-time fitness, nutrition, and workout advice, maintaining a strict on-topic policy.
 # Responsive UI:
 A modern, dark-themed, and responsive user interface built with Tailwind CSS,Robust API Handling: Uses a `fetchWithRetry` utility for reliable API calls 

# Setup & Installation

1)Node.js
2)Install Dependencies (npm install)
3)Configure API Key
       ('[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)';

4)Run the Application  (npm run dev)


# Tech Stack
  
1)React
2)Tailwind css
3)Llm - groq
4)API handling 
5) supabase (database)



# Predictive Logic

# 1.BMI Calculation (Client-Side Logic)
The Body Mass Index (BMI) is calculated directly in the client-side JavaScript using the utility function:
               BMI = WEIGHT/HEIGHT 

The calculated BMI and the user's profile are then passed to the AI to inform its plan generation.
# 2.Logic Behind Predicted Time
 1. Identify Goal & Total Change
The AI first looks at your Total Weight Differenc
2. Set the Base Weekly Rate
The model uses established, safe weekly rates as a starting point:

# 3. Personalize the Rate (The AI Adjustment)
The AI then fine-tunes this rate based on your profile to make it realistic:

Faster Rate: If you have a high BMI and an Active lifestyle.


Slower Rate: If you have a lower BMI or a Sedentary lifestyle, or if your equipment is limited (for muscle gain).

# 4. Calculate Time
Finally, it performs a simple division using the chosen, personalized rate:
.PREDICTED TIME(WEEKS)= TOTAL WEIGHT DIFFERENCE /PERSONALIZED WEEKLY RATE




.

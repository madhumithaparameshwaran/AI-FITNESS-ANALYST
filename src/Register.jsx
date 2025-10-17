import React, { useState } from 'react';

const Register = ({ onBack }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    // Dummy validation
    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    // Add real registration logic here
    alert('Registration successful!');
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center">
      <div className="bg-indigo-950/80 p-8 rounded-2xl shadow-2xl border border-indigo-900 w-full max-w-md">
        <h2 className="text-3xl font-bold text-white mb-6 text-center">Register</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-indigo-200 mb-1">Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-indigo-900/60 border border-purple-400 rounded-lg text-sm shadow-sm placeholder-indigo-300 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              required
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-indigo-200 mb-1">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-indigo-900/60 border border-purple-400 rounded-lg text-sm shadow-sm placeholder-indigo-300 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-indigo-200 mb-1">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-indigo-900/60 border border-purple-400 rounded-lg text-sm shadow-sm placeholder-indigo-300 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              required
            />
          </div>
          {error && <div className="text-red-400 text-sm text-center">{error}</div>}
          <button type="submit" className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-purple-700 transition duration-300 shadow-lg">Register</button>
        </form>
        <button onClick={onBack} className="mt-6 w-full text-indigo-300 hover:text-white text-sm">Back to Home</button>
      </div>
    </div>
  );
};

export default Register;

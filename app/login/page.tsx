'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const errorParam = searchParams.get('error');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(errorParam === 'CredentialsSignin' ? 'Invalid username or password' : '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError('Invalid username or password');
        setLoading(false);
      } else {
        // Force full reload to ensure session is picked up and state is cleared
        window.location.href = callbackUrl;
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <AmbientBackground />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/70 backdrop-blur-2xl border border-white/50 rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-indigo-500/10">
          
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-6 transform rotate-3 hover:rotate-6 transition-transform duration-300">
               <User className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Welcome Back</h1>
            <p className="text-slate-500 font-medium">Please sign in to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
             {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold animate-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {error}
                </div>
             )}

             <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Username</label>
                <div className="relative group">
                   <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                   </div>
                   <input
                     type="text"
                     value={username}
                     onChange={(e) => setUsername(e.target.value)}
                     className="w-full bg-slate-50 border-2 border-slate-100 text-slate-900 text-sm rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 block w-full pl-12 p-4 outline-none transition-all font-bold placeholder:font-medium placeholder:text-slate-300"
                     placeholder="Enter your username"
                     required
                   />
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Password</label>
                <div className="relative group">
                   <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                   </div>
                   <input
                     type="password"
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     className="w-full bg-slate-50 border-2 border-slate-100 text-slate-900 text-sm rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 block w-full pl-12 p-4 outline-none transition-all font-bold placeholder:font-medium placeholder:text-slate-300"
                     placeholder="••••••••"
                     required
                   />
                </div>
             </div>

             <button
               type="submit"
               disabled={loading}
               className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl p-4 transition-all duration-200 shadow-lg shadow-indigo-600/20 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
             >
               {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
               {!loading && <ArrowRight className="w-5 h-5" />}
             </button>
             
             <div className="text-center">
                 <p className="text-xs text-slate-400 font-medium mt-4">Inventory Management System v1.0</p>
             </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        </div>
    }>
        <LoginForm />
    </Suspense>
  );
}

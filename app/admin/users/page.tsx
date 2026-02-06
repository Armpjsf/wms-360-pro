'use client';

import { useState, useEffect } from 'react';
import { User, Shield, UserPlus, MoreVertical, CheckCircle, XCircle } from 'lucide-react';
import { useLanguage } from '@/components/providers/LanguageProvider';

export default function UserManagerPage() {
  const { t } = useLanguage();

  interface User {
      id: string;
      username: string;
      role: string;
      status: string;
      lastLogin: string;
  }

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState({ id: '', username: '', password: '', role: 'User', allowedBranches: ['*'] as string[] });
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  async function fetchUsers() {
      try {
          const res = await fetch('/api/admin/users');
          const data = await res.json();
          setUsers(data);
      } catch (err) {
          console.error(err);
      } finally {
          setLoading(false);
      }
  }

  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, []);

  const [branches, setBranches] = useState<any[]>([]);
  async function fetchBranches() {
      try {
          const res = await fetch('/api/branches');
          const data = await res.json();
          if (Array.isArray(data)) setBranches(data);
      } catch (e) { console.error(e); }
  }

  const toggleBranch = (branchId: string) => {
      const current = newUser.allowedBranches || ['*'];
      let updated;
      
      if (branchId === '*') {
          updated = ['*'];
      } else {
          // If current is *, clear it first? Or effectively toggling off * means explicit selection
          let clean = current.includes('*') ? [] : [...current];
          if (clean.includes(branchId)) {
              clean = clean.filter(id => id !== branchId);
          } else {
              clean.push(branchId);
          }
          updated = clean.length > 0 ? clean : ['*']; // Revert to * if empty? Or allow empty (no access)? Let's default to * if empty strictly.
      }
      setNewUser({ ...newUser, allowedBranches: updated });
  };

  const handleAddUser = async () => {
      if(!newUser.username || (!isEditing && !newUser.password)) return; 
      
      const payload = isEditing 
        ? { action: 'edit', data: newUser }
        : { action: 'add', data: newUser };

      await fetch('/api/admin/users', {
          method: 'POST', // Using POST for both based on existing pattern, usually PUT is better but keeping consistent
          body: JSON.stringify(payload)
      });
      setShowModal(false);
      setNewUser({ id: '', username: '', password: '', role: 'User', allowedBranches: ['*'] });
      setIsEditing(false);
      fetchUsers();
  };

  const handleEditUser = (user: any) => {
      setNewUser({ 
          id: user.id,
          username: user.username, 
          password: '', // Don't prefill password
          role: user.role, 
          allowedBranches: user.allowedBranches || ['*'] 
      });
      setIsEditing(true);
      setShowModal(true);
      setActiveMenu(null);
  };

  const handleDeleteUser = async (userId: string) => {
      if(!confirm('Are you sure you want to delete this user?')) return;
      await fetch('/api/admin/users', {
          method: 'DELETE',
          body: JSON.stringify({ id: userId })
      });
      fetchUsers();
      setActiveMenu(null); // Close menu
  };

  // Close menu on click outside (simple version: click anywhere else closes it IF we had a global listener, 
  // currently simplified to manual close or close on action)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
           <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
             <Shield className="w-8 h-8 text-blue-600" />
             {t('admin_users_title')}
           </h1>
           <p className="text-slate-500">{t('admin_users_subtitle')}</p>
        </div>
        <button 
           onClick={() => setShowModal(true)}
           className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"
        >
           <UserPlus className="w-4 h-4" />
           {t('add_user')}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-slate-700">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">{t('user_info')}</th>
              <th className="px-6 py-4">{t('role')}</th>
              <th className="px-6 py-4">{t('col_status')}</th>
              <th className="px-6 py-4">{t('last_login')}</th>
              <th className="px-6 py-4 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center bg-slate-900">{t('processing')}</td></tr>
            ) : users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{user.username}</div>
                      <div className="text-xs text-slate-500">{user.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs border ${
                    user.role === 'Admin' ? 'border-purple-500/30 text-purple-400 bg-purple-500/10' : 
                    user.role === 'Viewer' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' :
                    'border-slate-600 text-slate-400'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {user.status === 'Active' ? (
                       <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                       <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className={user.status === 'Active' ? 'text-green-400' : 'text-red-400'}>{user.status}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-500 text-sm font-mono">
                  {user.lastLogin}
                </td>
                <td className="px-6 py-4 text-right relative">
                  <button 
                    onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)}
                    className="text-slate-500 hover:text-blue-600 transition-colors p-2 rounded-full hover:bg-slate-100"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  
                  {activeMenu === user.id && (
                     <div className="absolute right-8 top-12 z-50 bg-white border border-slate-200 shadow-xl rounded-xl w-48 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <button 
                            onClick={() => handleEditUser(user)}
                            className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                            <UserPlus className="w-4 h-4" /> Edit User
                        </button>
                        <button 
                             onClick={() => handleDeleteUser(user.id)}
                            className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                            <XCircle className="w-4 h-4" /> Delete User
                        </button>
                     </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Modal */}
      {showModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
              <div className="bg-white border border-slate-200 p-6 rounded-xl w-full max-w-sm space-y-4 shadow-2xl">
                  <h3 className="text-lg font-bold text-slate-900">{t('add_user')}</h3>
                  
                  {/* Username */}
                  <div>
                      <label className="text-xs text-slate-500 block mb-1">{t('username')}</label>
                      <input 
                        className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500" 
                        placeholder={t('username')}
                        value={newUser.username}
                        onChange={e => setNewUser({...newUser, username: e.target.value})}
                      />
                  </div>

                  {/* Password */}
                  <div>
                      <label className="text-xs text-slate-500 block mb-1">{t('password')}</label>
                      <input 
                        type="password"
                        className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500" 
                        placeholder="******"
                        value={newUser.password}
                        onChange={e => setNewUser({...newUser, password: e.target.value})}
                      />
                  </div>

                  {/* Role */}
                  <div>
                      <label className="text-xs text-slate-500 block mb-1">{t('role')}</label>
                      <select 
                         className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                         value={newUser.role}
                         onChange={e => setNewUser({...newUser, role: e.target.value})}
                      >
                          <option value="User">{t('role_user')}</option>
                          <option value="Admin">{t('role_admin')}</option>
                          <option value="Viewer">{t('role_viewer')}</option>
                      </select>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {t('role_viewer_desc')}
                      </p>
                  </div>

                  {/* Branch Access */}
                  <div>
                      <label className="text-xs text-slate-500 block mb-1">Branch Access</label>
                      <div className="bg-slate-50 border border-slate-300 rounded p-2 max-h-32 overflow-y-auto space-y-1">
                          {/* All Access Option */}
                          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 p-1 rounded">
                              <input 
                                  type="checkbox" 
                                  checked={newUser.allowedBranches?.includes('*')}
                                  onChange={() => toggleBranch('*')}
                                  className="rounded text-blue-600 focus:ring-blue-500"
                              />
                               All Branches (Unlimited)
                          </label>
                          <div className="h-px bg-slate-200 my-1"/>
                          {branches.map(b => (
                              <label key={b.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-100 p-1 rounded">
                                  <input 
                                      type="checkbox" 
                                      checked={!newUser.allowedBranches?.includes('*') && newUser.allowedBranches?.includes(b.id)}
                                      onChange={() => toggleBranch(b.id)}
                                      disabled={newUser.allowedBranches?.includes('*')}
                                      className="rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                  />
                                   <span className={`w-2 h-2 rounded-full bg-${b.color}-500 inline-block`}></span>
                                   {b.name}
                              </label>
                          ))}
                      </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-4">
                      <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-400 hover:text-white">{t('cancel')}</button>
                      <button 
                        onClick={handleAddUser} 
                        disabled={!newUser.username || (!isEditing && !newUser.password)}
                        className="px-4 py-2 bg-blue-600 rounded text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('save') || 'Save'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

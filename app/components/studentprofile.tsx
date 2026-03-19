"use client";

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Camera, Trash2, Loader2} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/app/utils/supabase/client';

const StudentProfileCard = () => {
  const [student, setStudent] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{msg: string; type: 'success'|'error'} | null>(null);

  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };
  // useMemo ensures one stable Supabase client per component mount
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
        // If name is missing (e.g. first Google login before trigger runs), use metadata
        const name = data.name ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'Student';
        const avatar_url = data.avatar_url || user.user_metadata?.avatar_url || null;
        setStudent({ ...data, name, avatar_url });
      } else {
        // Profile row doesn't exist yet — use metadata directly
        setStudent({
          id: user.id,
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Student',
          avatar_url: user.user_metadata?.avatar_url || null,
        });
      }
    }
  }

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!event.target.files || event.target.files.length === 0 || !user) return;

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}-${Math.random()}.${fileExt}`;

      // 1. Upload image to 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from('Avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('Avatars')
        .getPublicUrl(filePath);

      // 3. Update profiles table with the new URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // 4. Refresh UI
      fetchProfile();
      showToast("Profile picture updated!");
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setUploading(false);
    }
  }
  async function handleDeleteAvatar() {
    try {
      if (!student?.avatar_url) return;
      // Deletion confirmed by button click

      setDeleting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Extract the file name from the URL to delete from storage
      // Example URL: .../storage/v1/object/public/avatars/filename.jpg
      const urlParts = student.avatar_url.split('/');
      const fileName = urlParts[urlParts.length - 1];

      // 2. Delete from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('Avatars')
        .remove([fileName]);

      if (storageError) throw storageError;

      // 3. Set avatar_url to NULL in the profiles table
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (dbError) throw dbError;

      // 4. Update local state to show the emoji again
      setStudent({ ...student, avatar_url: null });
      showToast("Profile picture removed.");

    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="w-full max-w-70 rounded-3xl bg-[#161725] p-6 text-center border border-white/5 shadow-xl text-white">
      <div className="relative mx-auto mb-4 h-24 w-24">
        <div className="relative flex h-full w-full items-center justify-center rounded-full border-2 border-white/10 bg-[#1c1d2e] overflow-hidden group">
          {student?.avatar_url ? (
            <img src={student.avatar_url} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <span className="text-4xl">👩‍💻</span>
          )}

          {/* Upload Overlay (Camera Icon) */}
          <label htmlFor="avatar-input" className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
            <Camera size={20} />
            <input type="file" id="avatar-input" accept="image/*" className="hidden" onChange={uploadAvatar} />
          </label>
        </div>

        {/* 5. Delete Button (only shows if an image exists) */}
        {student?.avatar_url && (
          <button
            onClick={handleDeleteAvatar}
            disabled={deleting}
            className="absolute -top-1 -right-1 p-1.5 bg-red-500 hover:bg-red-600 rounded-full border-2 border-[#161725] transition-colors"
            title="Delete photo"
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </button>
        )}
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-bold">{student?.name || "Student Name"}</h2>
      </div>
    <div className="mt-5 space-y-2">
      <Link href="/mocktest" className="text-white flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 py-3 text-sm font-bold hover:opacity-90 transition-all shadow-[0_0_12px_rgba(249,115,22,0.25)]">
        📝 Practice Tests
      </Link>
      <Link href="/dashboard" className="text-gray-400 flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 py-2.5 text-xs font-bold hover:bg-white/10 transition-all">
        ← Dashboard
      </Link>
    </div>
      {/* Toast */}
      {toast && (
        <div className={`mt-3 px-3 py-2 rounded-xl text-xs font-bold text-center transition-all ${toast.type === 'success' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default StudentProfileCard;
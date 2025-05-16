"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { User } from "@supabase/auth-js";
import { Profile, ItemStatusValues } from "@/types/database";
import Image from "next/image";

export default function ProfilePage() {
  const supabase = createClientComponentClient();
  
  // User and profile state
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  
  // Form state
  const [fullNameInput, setFullNameInput] = useState('');
  const [mobileNumberInput, setMobileNumberInput] = useState('');
  const [physicalAddressInput, setPhysicalAddressInput] = useState('');
  // const [avatarFile, setAvatarFile] = useState<File | null>(null); // Avatar feature removed
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Statistics state
  const [totalItemsReported, setTotalItemsReported] = useState(0);
  const [foundItemsCount, setFoundItemsCount] = useState(0);
  const [lostItemsCount, setLostItemsCount] = useState(0);
  const [pointsEarned, setPointsEarned] = useState(0);

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Get authenticated user
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !authUser) {
          setError(authError?.message || 'User not authenticated.');
          setLoading(false);
          return;
        }
        
        setUser(authUser);
        
        // Get user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();
        
        if (profileError) {
          console.error("Profile fetch error:", profileError);
          if (profileError.code !== 'PGRST116') { // Not found error
            setError(`Error fetching profile: ${profileError.message}`);
          }
        } else if (profileData) {
          setProfile(profileData as Profile);
          setFullNameInput(profileData.full_name || '');
          setMobileNumberInput(profileData.mobile_number || '');
          setPhysicalAddressInput(profileData.physical_address || '');
        }
        
        // Get user statistics
        // 1. Count items uploaded by user
        const { data: itemsData, error: itemsError } = await supabase
          .from('items')
          .select('id, status')
          .eq('user_id', authUser.id);
        
        if (!itemsError && itemsData) {
          // Calculate total, found, and lost items
          const totalItems = itemsData.length;
          const foundItems = itemsData.filter(item => item.status === 'found');
          const lostItems = itemsData.filter(item => item.status === 'lost');
          
          setTotalItemsReported(totalItems);
          setFoundItemsCount(foundItems.length);
          setLostItemsCount(lostItems.length);
          
          // Calculate points based on 'found' items
          setPointsEarned(foundItems.length * 5);
        }
      } catch (err: any) {
        console.error("Unexpected error:", err);
        setError(`An unexpected error occurred: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserAndProfile();
  }, [supabase]);
  
  const handleEditToggle = () => {
    setEditMode(!editMode);
    setUpdateMessage(null);
    setUpdateError(null);
    
    // Reset form fields to current profile data when entering edit mode
    if (!editMode && profile) {
      setFullNameInput(profile.full_name || '');
      setMobileNumberInput(profile.mobile_number || '');
      setPhysicalAddressInput(profile.physical_address || '');
      setNewPassword('');
      setConfirmPassword('');
      // setAvatarFile(null); // Avatar feature removed
    }
  };
  
  // const handleAvatarChange = ...; // Avatar feature removed: function definition removed.
  
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset messages
    setUpdateMessage(null);
    setUpdateError(null);
    
    // Basic validation
    if (!user) {
      setUpdateError("You must be logged in to update your profile");
      return;
    }
    
    // Check password match
    if (newPassword) {
      if (newPassword !== confirmPassword) {
        setUpdateError('Passwords do not match.');
        return;
      }
    }
    
    try {
      // 1. Update password if requested
      if (newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: newPassword
        });
        
        if (passwordError) {
          setUpdateError(`Password update failed: ${passwordError.message}`);
          return;
        }
      }
      
      // Avatar upload logic removed.
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullNameInput || null,
          mobile_number: mobileNumberInput || null,
          physical_address: physicalAddressInput || null
        })
        .eq('id', user.id);
      
      if (updateError) {
        setUpdateError(`Profile update failed: ${updateError.message}`);
        return;
      }
      
      // 3. Refresh profile data
      const { data: refreshedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (refreshedProfile) {
        setProfile(refreshedProfile);
      }
      
      // 4. Reset form state
      setEditMode(false);
      setNewPassword('');
      setConfirmPassword('');
      // setAvatarFile(null); // Avatar feature removed, so this call is no longer needed
      setUpdateMessage('Profile updated successfully!');
      
    } catch (error) {
      console.error("Profile update error:", error);
      setUpdateError("An error occurred while updating your profile");
    }
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto p-4 text-center">
        <div className="animate-pulse">Loading profile...</div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }
  
  // Not logged in
  if (!user) {
    return (
      <div className="container mx-auto p-4 text-center">
        <p className="text-lg">Please log in to view your profile.</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Your Profile</h1>
      
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6">
        {/* Avatar and basic info */}
        <div className="flex flex-col items-center sm:flex-row sm:items-start mb-6">
          <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 mb-4 sm:mb-0 sm:mr-6 flex items-center justify-center">
            <div className="text-gray-500 dark:text-gray-400 text-4xl font-bold">
              {profile?.full_name ? profile.full_name[0].toUpperCase() : user?.email?.[0]?.toUpperCase() || '?'}
            </div>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              {profile?.full_name || 'User'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">{user.email}</p>
          </div>
        </div>
        {/* Statistics section */}
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Account Statistics</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Items Reported</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{totalItemsReported}</p>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow">
              <p className="text-sm text-gray-500 dark:text-gray-400">Found Items Reported</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{foundItemsCount}</p>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow">
              <p className="text-sm text-gray-500 dark:text-gray-400">Lost Items Reported</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{lostItemsCount}</p>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow">
              <p className="text-sm text-gray-500 dark:text-gray-400">Points Earned</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{pointsEarned}</p>
            </div>
          </div>
        </div>
        
        {/* Personal information section */}
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 flex justify-between items-center">
            Personal Information
            <button 
              onClick={handleEditToggle} 
              className={`px-4 py-2 rounded-md text-sm font-medium ${editMode ? 'bg-gray-500 hover:bg-gray-600' : 'bg-indigo-600 hover:bg-indigo-700'} text-white`}
            >
              {editMode ? 'Cancel' : 'Edit'}
            </button>
          </h3>
          
          {/* Status messages */}
          {updateMessage && (
            <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-md">
              {updateMessage}
            </div>
          )}
          {updateError && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-md">
              {updateError}
            </div>
          )}
          
          {/* Edit form or display view */}
          {editMode ? (
            <form onSubmit={handleSaveChanges} className="space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Full Name
                </label>
                <input
                  type="text"
                  id="fullName"
                  value={fullNameInput}
                  onChange={(e) => setFullNameInput(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mobile Number
                </label>
                <input
                  type="text"
                  id="mobileNumber"
                  value={mobileNumberInput}
                  onChange={(e) => setMobileNumberInput(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label htmlFor="physicalAddress" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Physical Address
                </label>
                <textarea
                  id="physicalAddress"
                  value={physicalAddressInput}
                  onChange={(e) => setPhysicalAddressInput(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 dark:text-white"
                />
              </div>
              
              {/* Avatar file input removed previously */}
              
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <h4 className="text-md font-medium text-gray-800 dark:text-white mb-3">Change Password (Optional)</h4>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      New Password
                    </label>
                    <input
                      type="password"
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p><span className="font-medium">Full Name:</span> {profile?.full_name || 'Not set'}</p>
              <p><span className="font-medium">Email:</span> {user?.email || 'Not available'}</p>
              <p><span className="font-medium">Mobile Number:</span> {profile?.mobile_number || 'Not set'}</p>
              <p><span className="font-medium">Physical Address:</span> {profile?.physical_address || 'Not set'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

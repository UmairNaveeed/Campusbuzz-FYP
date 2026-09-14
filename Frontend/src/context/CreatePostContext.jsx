import React, { createContext, useContext, useState } from 'react';

const CreatePostContext = createContext();

export function CreatePostProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  const openCreatePost = () => setIsOpen(true);
  const closeCreatePost = () => setIsOpen(false);

  return (
    <CreatePostContext.Provider value={{ isOpen, openCreatePost, closeCreatePost }}>
      {children}
    </CreatePostContext.Provider>
  );
}

export const useCreatePost = () => {
  const context = useContext(CreatePostContext);
  if (!context) {
    return { isOpen: false, openCreatePost: () => {}, closeCreatePost: () => {} };
  }
  return context;
};

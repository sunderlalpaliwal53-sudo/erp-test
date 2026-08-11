import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export const AppShell = ({ children }) => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
};

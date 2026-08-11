import React from 'react';
import HomeworkPage from '@/pages/Homework';
import TimetablePage from '@/pages/Timetable';
import EventsPage from '@/pages/Events';
import Circulars from '@/pages/Circulars';
import GalleryPage from '@/pages/Gallery';
import NotificationsPage from '@/pages/Notifications';

// Parent uses the same read views for these modules.
export const ParentHomework = () => <HomeworkPage />;
export const ParentTimetable = () => <TimetablePage />;
export const ParentEvents = () => <EventsPage />;
export const ParentCirculars = () => <Circulars />;
export const ParentGallery = () => <GalleryPage />;
export const ParentNotifications = () => <NotificationsPage />;

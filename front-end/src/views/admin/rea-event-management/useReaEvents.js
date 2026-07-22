import { useState, useCallback } from 'react';
import api from '../../../utils/api';

export const useReaEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.eventType) params.append('event_type', filters.eventType);
      if (filters.dateFrom) params.append('date_from', filters.dateFrom);
      if (filters.dateTo) params.append('date_to', filters.dateTo);
      params.append('limit', '100');
      params.append('offset', '0');

      const response = await api.get(`/events?${params.toString()}`);
      setEvents(response.data.data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch events');
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const retryEvent = useCallback(async (eventId) => {
    try {
      await api.post(`/events/${eventId}/retry`);
      fetchEvents();
      return { success: true };
    } catch (err) {
      setError(err.message || 'Failed to retry event');
      return { success: false, error: err.message };
    }
  }, [fetchEvents]);

  const deleteEvent = useCallback(async (eventId) => {
    try {
      await api.delete(`/events/${eventId}`);
      setEvents(events.filter(e => e.id !== eventId));
      return { success: true };
    } catch (err) {
      setError(err.message || 'Failed to delete event');
      return { success: false, error: err.message };
    }
  }, [events]);

  const getEventStats = useCallback(() => {
    const stats = {
      total: events.length,
      pending: events.filter(e => e.status === 'PENDING').length,
      processing: events.filter(e => e.status === 'PROCESSING').length,
      completed: events.filter(e => e.status === 'COMPLETED').length,
      failed: events.filter(e => e.status === 'FAILED').length,
    };
    return stats;
  }, [events]);

  return {
    events,
    loading,
    error,
    fetchEvents,
    retryEvent,
    deleteEvent,
    getEventStats
  };
};
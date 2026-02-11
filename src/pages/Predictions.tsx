import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { Plus } from 'lucide-react';
import PredictionList from '../components/predictions/PredictionList';
import PredictionForm from '../components/predictions/PredictionForm';
import PredictionCloseModal from '../components/predictions/PredictionCloseModal';
import FilterPills from '../components/FilterPills';
import PageTransition from '../components/PageTransition';
import type { Prediction } from '../types';

export default function Predictions() {
  const { predictions, predictionsLoading, fetchPredictions } = useStore(useShallow((s) => ({
    predictions: s.predictions,
    predictionsLoading: s.predictionsLoading,
    fetchPredictions: s.fetchPredictions,
  })));
  const [showForm, setShowForm] = useState(false);
  const [editingPrediction, setEditingPrediction] = useState<Prediction | null>(null);
  const [closingPrediction, setClosingPrediction] = useState<Prediction | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  const filteredPredictions = predictions.filter((p) => {
    if (filter === 'open' && p.status !== 'open') return false;
    if (filter === 'closed' && p.status !== 'closed') return false;
    return true;
  });

  const handleNewPrediction = () => {
    setEditingPrediction(null);
    setClosingPrediction(null);
    setShowForm(true);
  };

  const handleEditPrediction = (prediction: Prediction) => {
    setEditingPrediction(prediction);
    setClosingPrediction(null);
    setShowForm(true);
  };

  const handleClosePrediction = (prediction: Prediction) => {
    setClosingPrediction(prediction);
    setEditingPrediction(null);
    setShowForm(false);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingPrediction(null);
    setClosingPrediction(null);
  };

  const openCount = predictions.filter(p => p.status === 'open').length;
  const closedCount = predictions.filter(p => p.status === 'closed').length;

  return (
    <PageTransition>
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px', letterSpacing: '-0.5px' }}>
            Predictions
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Track your prediction market bets
          </p>
        </div>
        <button onClick={handleNewPrediction} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} />
          New Prediction
        </button>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: '28px' }}>
        <FilterPills
          options={[
            { key: 'all', label: 'All', count: predictions.length },
            { key: 'open', label: 'Open', count: openCount },
            { key: 'closed', label: 'Closed', count: closedCount },
          ]}
          active={filter}
          onChange={(key) => setFilter(key as typeof filter)}
        />
      </div>

      {/* Content */}
      {predictionsLoading ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      ) : (
        <PredictionList
          predictions={filteredPredictions}
          onEdit={handleEditPrediction}
          onClose={handleClosePrediction}
        />
      )}

      {/* New/Edit Form Modal */}
      {showForm && (
        <PredictionForm
          prediction={editingPrediction}
          isEditing={!!editingPrediction}
          onClose={handleFormClose}
        />
      )}

      {/* Close Modal */}
      {closingPrediction && (
        <PredictionCloseModal
          prediction={closingPrediction}
          onClose={handleFormClose}
        />
      )}
    </div>
    </PageTransition>
  );
}

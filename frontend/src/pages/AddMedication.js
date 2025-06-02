import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Alert, LoadingSpinner } from '../components';
import { useNavigate } from 'react-router-dom';
import useMedicationStore from '../store/medicationStore';
import useRegimenStore from '../store/regimenStore';
import useAuthStore from '../store/authStore';
import { calendarService } from '../services/calendarService';

const AddMedication = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createMedication, loading: medicationLoading } = useMedicationStore();
  const { createRegimen, loading: regimenLoading } = useRegimenStore();
  
  const [step, setStep] = useState(1);
  const [medication, setMedication] = useState({
    name: '',
    genericName: '',
    category: 'Other',
    form: 'tablet',
    strength: { amount: '', unit: 'mg' },
    manufacturer: '',
    color: '',
    shape: '',
    sideEffects: [],
    instructions: {
      withFood: 'not_specified',
      specialInstructions: ''
    }
  });
  
  const [regimen, setRegimen] = useState({
    category: 'General',
    patientInfo: {
      name: user?.firstName + ' ' + user?.lastName || '',
      relationship: 'self',
      isPatient: true
    },
    dosage: { amount: '', unit: 'tablet' },
    frequency: 'once_daily',
    customSchedule: [],
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    purpose: '',
    notes: '',
    reminders: {
      enabled: true,
      timesBefore: [30, 10],
      methods: ['app']
    },
    refillReminder: {
      enabled: true,
      daysBeforeEmpty: 7,
      currentStock: 0
    }
  });
  
  const [customTimes, setCustomTimes] = useState(['08:00']);
  const [error, setError] = useState('');
  const [sideEffect, setSideEffect] = useState('');

  const categories = [
    'Heart & Blood Pressure',
    'Diabetes',
    'Pain & Inflammation',
    'Mental Health',
    'Antibiotics',
    'Vitamins & Supplements',
    'Respiratory',
    'Digestive',
    'Hormonal',
    'Other'
  ];

  const frequencies = [
    { value: 'once_daily', label: 'Once daily', times: ['08:00'] },
    { value: 'twice_daily', label: 'Twice daily', times: ['08:00', '20:00'] },
    { value: 'three_times_daily', label: 'Three times daily', times: ['08:00', '14:00', '20:00'] },
    { value: 'four_times_daily', label: 'Four times daily', times: ['08:00', '12:00', '16:00', '20:00'] },
    { value: 'every_other_day', label: 'Every other day', times: ['08:00'] },
    { value: 'weekly', label: 'Weekly', times: ['08:00'] },
    { value: 'as_needed', label: 'As needed', times: [] },
    { value: 'custom', label: 'Custom schedule', times: [] }
  ];

  const familyMembers = [
    { value: 'self', label: 'Myself' },
    { value: 'spouse', label: 'Spouse/Partner' },
    { value: 'child', label: 'Child' },
    { value: 'parent', label: 'Parent' },
    { value: 'sibling', label: 'Sibling' },
    { value: 'other', label: 'Other Family Member' }
  ];

  useEffect(() => {
    if (regimen.frequency === 'custom') {
      setRegimen(prev => ({
        ...prev,
        customSchedule: customTimes.map((time, index) => ({
          time,
          label: getTimeLabel(time)
        }))
      }));
    }
  }, [customTimes, regimen.frequency]);

  const getTimeLabel = (time) => {
    const hour = parseInt(time.split(':')[0]);
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    if (hour < 21) return 'Evening';
    return 'Night';
  };

  const handleMedicationChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setMedication(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setMedication(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleRegimenChange = (field, value) => {
    if (field.includes('.')) {
      const fields = field.split('.');
      setRegimen(prev => {
        const updated = { ...prev };
        let current = updated;
        for (let i = 0; i < fields.length - 1; i++) {
          current = current[fields[i]];
        }
        current[fields[fields.length - 1]] = value;
        return updated;
      });
    } else {
      setRegimen(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const addSideEffect = () => {
    if (sideEffect.trim()) {
      setMedication(prev => ({
        ...prev,
        sideEffects: [...prev.sideEffects, sideEffect.trim()]
      }));
      setSideEffect('');
    }
  };

  const removeSideEffect = (index) => {
    setMedication(prev => ({
      ...prev,
      sideEffects: prev.sideEffects.filter((_, i) => i !== index)
    }));
  };

  const addCustomTime = () => {
    setCustomTimes(prev => [...prev, '12:00']);
  };

  const removeCustomTime = (index) => {
    setCustomTimes(prev => prev.filter((_, i) => i !== index));
  };

  const updateCustomTime = (index, time) => {
    setCustomTimes(prev => prev.map((t, i) => i === index ? time : t));
  };

  const handleFrequencyChange = (freq) => {
    setRegimen(prev => ({ ...prev, frequency: freq }));
    
    const selectedFreq = frequencies.find(f => f.value === freq);
    if (selectedFreq && freq !== 'custom') {
      setCustomTimes(selectedFreq.times);
    } else if (freq === 'custom' && customTimes.length === 0) {
      setCustomTimes(['08:00']);
    }
  };

  const validateStep1 = () => {
    if (!medication.name.trim()) {
      setError('Medication name is required');
      return false;
    }
    if (!medication.strength.amount) {
      setError('Medication strength is required');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!regimen.dosage.amount) {
      setError('Dosage amount is required');
      return false;
    }
    if (regimen.frequency === 'custom' && customTimes.length === 0) {
      setError('At least one time is required for custom schedule');
      return false;
    }
    if (!regimen.startDate) {
      setError('Start date is required');
      return false;
    }
    if (regimen.endDate && new Date(regimen.endDate) <= new Date(regimen.startDate)) {
      setError('End date must be after start date');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (validateStep1()) {
        setStep(2);
      }
    }
  };
  const handleSubmit = async () => {
    setError('');
    
    if (!validateStep2()) return;

    try {
      // Create medication first
      const newMedication = await createMedication(medication);
      
      // Then create regimen
      const regimenData = {
        ...regimen,
        medication: newMedication.medication._id
      };
      
      const newRegimen = await createRegimen(regimenData);
      
      // Check if user has calendar connected and auto-sync enabled
      try {
        const calendarStatus = await calendarService.getConnectionStatus();
        if (calendarStatus.isConnected && calendarStatus.settings?.autoSync) {
          // Automatically sync the new regimen to calendar
          await calendarService.syncScheduleToCalendar(newRegimen.regimen._id);
          console.log('✅ New regimen automatically synced to Google Calendar');
        }
      } catch (calendarError) {
        // Don't fail the entire operation if calendar sync fails
        console.warn('Calendar auto-sync failed:', calendarError);
      }
      
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to add medication');
    }
  };

  const isLoading = medicationLoading || regimenLoading;
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Add New Medication</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Step {step} of 2: {step === 1 ? 'Medication Details' : 'Schedule & Settings'}
          </p>
          
          {/* Progress Bar */}
          <div className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-medical-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(step / 2) * 100}%` }}
            />
          </div>
        </div>

        {error && (
          <Alert type="error" message={error} className="mb-6" />
        )}        <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          {step === 1 ? (
            /* Step 1: Medication Details */
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Medication Name *
                </label>
                <Input
                  value={medication.name}
                  onChange={(e) => handleMedicationChange('name', e.target.value)}
                  placeholder="e.g., Lisinopril, Metformin, Ibuprofen"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Generic Name
                </label>
                <Input
                  value={medication.genericName}
                  onChange={(e) => handleMedicationChange('genericName', e.target.value)}
                  placeholder="Generic or scientific name"
                  className="w-full"
                />
              </div>              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category *
                  </label>
                  <select
                    value={medication.category}
                    onChange={(e) => handleMedicationChange('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-medical-500 dark:focus:ring-medical-400"
                  >
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Form *
                  </label>
                  <select
                    value={medication.form}
                    onChange={(e) => handleMedicationChange('form', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-medical-500 dark:focus:ring-medical-400"
                  >
                    <option value="tablet">Tablet</option>
                    <option value="capsule">Capsule</option>
                    <option value="liquid">Liquid</option>
                    <option value="injection">Injection</option>
                    <option value="topical">Topical</option>
                    <option value="inhaler">Inhaler</option>
                    <option value="drops">Drops</option>
                    <option value="patch">Patch</option>
                  </select>
                </div>
              </div>              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Strength *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    value={medication.strength.amount}
                    onChange={(e) => handleMedicationChange('strength.amount', parseFloat(e.target.value))}
                    placeholder="Amount"
                  />
                  <select
                    value={medication.strength.unit}
                    onChange={(e) => handleMedicationChange('strength.unit', e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-medical-500 dark:focus:ring-medical-400"
                  >
                    <option value="mg">mg</option>
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                    <option value="mcg">mcg</option>
                    <option value="IU">IU</option>
                    <option value="units">units</option>
                  </select>
                </div>
              </div>              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Color
                  </label>
                  <Input
                    value={medication.color}
                    onChange={(e) => handleMedicationChange('color', e.target.value)}
                    placeholder="e.g., White, Blue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Shape
                  </label>
                  <Input
                    value={medication.shape}
                    onChange={(e) => handleMedicationChange('shape', e.target.value)}
                    placeholder="e.g., Round, Oval"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Manufacturer
                </label>
                <Input
                  value={medication.manufacturer}
                  onChange={(e) => handleMedicationChange('manufacturer', e.target.value)}
                  placeholder="Pharmaceutical company"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Food Instructions
                </label>
                <select
                  value={medication.instructions.withFood}
                  onChange={(e) => handleMedicationChange('instructions.withFood', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-medical-500 dark:focus:ring-medical-400"
                >
                  <option value="not_specified">Not specified</option>
                  <option value="required">Take with food</option>
                  <option value="optional">May take with or without food</option>
                  <option value="avoid">Take on empty stomach</option>
                </select>
              </div>              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Side Effects
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={sideEffect}
                      onChange={(e) => setSideEffect(e.target.value)}
                      placeholder="Add a side effect"
                      className="flex-1"
                    />
                    <Button 
                      type="button" 
                      onClick={addSideEffect}
                      variant="outline"
                    >
                      Add
                    </Button>
                  </div>
                  
                  {medication.sideEffects.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {medication.sideEffects.map((effect, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700"
                        >
                          {effect}
                          <button
                            type="button"
                            onClick={() => removeSideEffect(index)}
                            className="ml-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Special Instructions
                </label>
                <textarea
                  value={medication.instructions.specialInstructions}
                  onChange={(e) => handleMedicationChange('instructions.specialInstructions', e.target.value)}
                  placeholder="Any special instructions for taking this medication..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-medical-500 dark:focus:ring-medical-400"
                />
              </div>
            </div>
          ) : (            /* Step 2: Schedule & Settings */
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Patient Category
                </label>
                <Input
                  value={regimen.category}
                  onChange={(e) => handleRegimenChange('category', e.target.value)}
                  placeholder="e.g., Morning Meds, Heart Medication"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  For whom is this medication?
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <select
                    value={regimen.patientInfo.relationship}
                    onChange={(e) => handleRegimenChange('patientInfo.relationship', e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-medical-500 dark:focus:ring-medical-400"
                  >
                    {familyMembers.map(member => (
                      <option key={member.value} value={member.value}>{member.label}</option>
                    ))}
                  </select>
                  
                  {regimen.patientInfo.relationship !== 'self' && (
                    <Input
                      value={regimen.patientInfo.name}
                      onChange={(e) => handleRegimenChange('patientInfo.name', e.target.value)}
                      placeholder="Family member's name"
                    />
                  )}
                </div>
              </div>              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dosage *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    value={regimen.dosage.amount}
                    onChange={(e) => handleRegimenChange('dosage.amount', parseFloat(e.target.value))}
                    placeholder="Amount"
                  />
                  <select
                    value={regimen.dosage.unit}
                    onChange={(e) => handleRegimenChange('dosage.unit', e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-medical-500 dark:focus:ring-medical-400"
                  >
                    <option value="tablet">tablet(s)</option>
                    <option value="capsule">capsule(s)</option>
                    <option value="ml">ml</option>
                    <option value="mg">mg</option>
                    <option value="g">g</option>
                    <option value="tsp">tsp</option>
                    <option value="tbsp">tbsp</option>
                    <option value="puff">puff(s)</option>
                    <option value="drop">drop(s)</option>
                    <option value="patch">patch(es)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Frequency *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {frequencies.map(freq => (
                    <button
                      key={freq.value}
                      type="button"
                      onClick={() => handleFrequencyChange(freq.value)}
                      className={`p-3 rounded-lg border text-left transition-all duration-200 ${
                        regimen.frequency === freq.value
                          ? 'border-medical-500 bg-medical-50 dark:bg-medical-900/20 text-medical-700 dark:text-medical-300'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="font-medium">{freq.label}</div>
                      {freq.times.length > 0 && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {freq.times.join(', ')}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>              {regimen.frequency === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Custom Times
                  </label>
                  <div className="space-y-2">
                    {customTimes.map((time, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => updateCustomTime(index, e.target.value)}
                          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-medical-500 dark:focus:ring-medical-400"
                        />
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {getTimeLabel(time)}
                        </span>
                        {customTimes.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeCustomTime(index)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addCustomTime}
                    >
                      Add Time
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={regimen.startDate}
                    onChange={(e) => handleRegimenChange('startDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-medical-500 dark:focus:ring-medical-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={regimen.endDate}
                    onChange={(e) => handleRegimenChange('endDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-medical-500 dark:focus:ring-medical-400"
                  />
                </div>
              </div>              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Purpose / Condition
                </label>
                <Input
                  value={regimen.purpose}
                  onChange={(e) => handleRegimenChange('purpose', e.target.value)}
                  placeholder="What is this medication for?"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Stock (for refill reminders)
                </label>
                <Input
                  type="number"
                  value={regimen.refillReminder.currentStock}
                  onChange={(e) => handleRegimenChange('refillReminder.currentStock', parseInt(e.target.value))}
                  placeholder="Number of doses remaining"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes
                </label>
                <textarea
                  value={regimen.notes}
                  onChange={(e) => handleRegimenChange('notes', e.target.value)}
                  placeholder="Any additional notes about this medication..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-medical-500 dark:focus:ring-medical-400"
                />
              </div>

              {/* Reminder Settings */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Reminder Settings</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="reminders-enabled"
                      checked={regimen.reminders.enabled}
                      onChange={(e) => handleRegimenChange('reminders.enabled', e.target.checked)}
                      className="h-4 w-4 text-medical-600 dark:text-medical-500 focus:ring-medical-500 dark:focus:ring-medical-400 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                    />
                    <label htmlFor="reminders-enabled" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Enable reminders
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="refill-enabled"
                      checked={regimen.refillReminder.enabled}
                      onChange={(e) => handleRegimenChange('refillReminder.enabled', e.target.checked)}
                      className="h-4 w-4 text-medical-600 dark:text-medical-500 focus:ring-medical-500 dark:focus:ring-medical-400 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                    />
                    <label htmlFor="refill-enabled" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Enable refill reminders
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <div className="flex space-x-3">
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  disabled={isLoading}
                >
                  Back
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
            
            <div>
              {step < 2 ? (
                <Button onClick={handleNext} disabled={isLoading}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isLoading}>
                  {isLoading ? <LoadingSpinner size="sm" /> : 'Add Medication'}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AddMedication;

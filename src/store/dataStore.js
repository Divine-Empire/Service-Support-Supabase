import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useDataStore = create(
  persist(
    (set, get) => ({
      // Sauda Form Data
      saudaData: [],
      addSauda: (data) => set((state) => ({
        saudaData: [...state.saudaData, { ...data, id: Date.now(), createdBy: data.createdBy }]
      })),

      // DO Generate Data
      doData: [],
      addDO: (data) => set((state) => ({
        doData: [...state.doData, { ...data, id: Date.now(), serialNumber: state.doData.length + 1, createdBy: data.createdBy }]
      })),

      // Gate In Data
      gateInData: [],
      updateGateIn: (id, gateInDateTime) => set((state) => ({
        gateInData: state.gateInData.map(item => 
          item.id === id ? { ...item, gateInDateTime, status: 'completed' } : item
        )
      })),
      addToGateIn: (doItem) => set((state) => ({
        gateInData: [...state.gateInData, { ...doItem, status: 'pending', gateInDateTime: null }]
      })),

      // Tyre Weight Data
      tyreWeightData: [],
      updateTyreWeight: (id, remarks) => set((state) => ({
        tyreWeightData: state.tyreWeightData.map(item => 
          item.id === id ? { ...item, remarks, tyreWeightStatus: 'completed' } : item
        )
      })),

      // Loading Data
      loadingData: [],
      updateLoading1st: (id, status) => set((state) => ({
        loadingData: state.loadingData.map(item => 
          item.id === id ? { ...item, loading1stStatus: status, loading1stCompleted: true } : item
        )
      })),
      updateLoading2nd: (id, status) => set((state) => ({
        loadingData: state.loadingData.map(item => 
          item.id === id ? { ...item, loading2ndStatus: status, loading2ndCompleted: true } : item
        )
      })),

      // Final Weight Data
      finalWeightData: [],
      updateFinalWeight: (id, finalWeight, weighmentCopy) => set((state) => ({
        finalWeightData: state.finalWeightData.map(item => 
          item.id === id ? { ...item, finalWeight, weighmentCopy, finalWeightCompleted: true } : item
        )
      })),

      // QC Data
      qcData: [],
      updateQC: (id, qcDetails) => set((state) => ({
        qcData: state.qcData.map(item => 
          item.id === id ? { ...item, ...qcDetails, qcCompleted: true } : item
        )
      })),

      // Invoice Data
      invoiceData: [],
      updateInvoice: (id, invoiceDetails) => set((state) => ({
        invoiceData: state.invoiceData.map(item => 
          item.id === id ? { ...item, ...invoiceDetails, invoiceCompleted: true } : item
        )
      })),

      // Get Out Data
      getOutData: [],
      updateGetOut: (id, status) => set((state) => ({
        getOutData: state.getOutData.map(item => 
          item.id === id ? { ...item, getOutStatus: status, getOutCompleted: true } : item
        )
      })),

      // Helper function to get filtered data based on user role
      getFilteredData: (dataType, user) => {
        const state = get();
        const data = state[dataType] || [];
        
        if (user?.role === 'admin') {
          return data;
        } else {
          return data.filter(item => item.createdBy === user?.id);
        }
      }
    }),
    {
      name: 'o2d-data-storage',
    }
  )
);

export default useDataStore;













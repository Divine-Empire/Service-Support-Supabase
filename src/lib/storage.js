// Local Storage Management for Service Support System
class ServiceSupportStorage {
  constructor() {
    this.storageKey = 'serviceSupportData';
    this.init();
  }

  init() {
    if (!localStorage.getItem(this.storageKey)) {
      const initialData = {
        tickets: [],
        clients: [],
        engineers: [],
        lastTicketId: 0
      };
      localStorage.setItem(this.storageKey, JSON.stringify(initialData));
    }
  }

  getData() {
    return JSON.parse(localStorage.getItem(this.storageKey));
  }

  saveData(data) {
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  // Ticket Management
  getTickets() {
    const data = this.getData();
    return data.tickets || [];
  }

  getTicketById(id) {
    const tickets = this.getTickets();
    return tickets.find(ticket => ticket.id === id);
  }

  addTicket(ticket) {
    const data = this.getData();
    const newTicket = {
      ...ticket,
      id: ticket.id || `TK-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    data.tickets.push(newTicket);
    data.lastTicketId = data.tickets.length;
    this.saveData(data);
    return newTicket;
  }

  updateTicket(updatedTicket) {
    const data = this.getData();
    const ticketIndex = data.tickets.findIndex(ticket => ticket.id === updatedTicket.id);
    
    if (ticketIndex !== -1) {
      data.tickets[ticketIndex] = {
        ...data.tickets[ticketIndex],
        ...updatedTicket,
        updatedAt: new Date().toISOString()
      };
      this.saveData(data);
      return data.tickets[ticketIndex];
    }
    return null;
  }

  deleteTicket(ticketId) {
    const data = this.getData();
    data.tickets = data.tickets.filter(ticket => ticket.id !== ticketId);
    this.saveData(data);
    return true;
  }

  // Client Management
  getClients() {
    const data = this.getData();
    return data.clients || [];
  }

  addClient(client) {
    const data = this.getData();
    const newClient = {
      ...client,
      id: `CL-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    
    data.clients.push(newClient);
    this.saveData(data);
    return newClient;
  }

  // Engineer Management
  getEngineers() {
    const data = this.getData();
    return data.engineers || [];
  }

  addEngineer(engineer) {
    const data = this.getData();
    const newEngineer = {
      ...engineer,
      id: `ENG-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    
    data.engineers.push(newEngineer);
    this.saveData(data);
    return newEngineer;
  }

  // Workflow Status Management
  getTicketsByStatus(status) {
    const tickets = this.getTickets();
    return tickets.filter(ticket => ticket.status === status);
  }

  getTicketsByStatusList(statusList) {
    const tickets = this.getTickets();
    return tickets.filter(ticket => statusList.includes(ticket.status));
  }

  // Statistics and Reporting
  getTicketStats() {
    const tickets = this.getTickets();
    const total = tickets.length;
    const pending = tickets.filter(t => t.status === 'pending').length;
    const completed = tickets.filter(t => t.status === 'completed').length;
    const inProgress = total - pending - completed;

    return {
      total,
      pending,
      completed,
      inProgress
    };
  }

  // Search and Filter
  searchTickets(query) {
    const tickets = this.getTickets();
    const lowerQuery = query.toLowerCase();
    
    return tickets.filter(ticket => 
      ticket.clientName?.toLowerCase().includes(lowerQuery) ||
      ticket.title?.toLowerCase().includes(lowerQuery) ||
      ticket.id?.toLowerCase().includes(lowerQuery) ||
      ticket.phoneNumber?.includes(query) ||
      ticket.emailAddress?.toLowerCase().includes(lowerQuery)
    );
  }

  filterTickets(filters) {
    let tickets = this.getTickets();
    
    if (filters.status) {
      tickets = tickets.filter(ticket => ticket.status === filters.status);
    }
    
    if (filters.priority) {
      tickets = tickets.filter(ticket => ticket.priority === filters.priority);
    }
    
    if (filters.category) {
      tickets = tickets.filter(ticket => ticket.category === filters.category);
    }
    
    if (filters.engineerAssign) {
      tickets = tickets.filter(ticket => ticket.engineerAssign === filters.engineerAssign);
    }
    
    if (filters.dateFrom) {
      tickets = tickets.filter(ticket => new Date(ticket.date) >= new Date(filters.dateFrom));
    }
    
    if (filters.dateTo) {
      tickets = tickets.filter(ticket => new Date(ticket.date) <= new Date(filters.dateTo));
    }
    
    return tickets;
  }

  // Export/Import functionality
  exportData() {
    return this.getData();
  }

  importData(data) {
    this.saveData(data);
  }

  // Clear all data
  clearAllData() {
    const initialData = {
      tickets: [],
      clients: [],
      engineers: [],
      lastTicketId: 0
    };
    this.saveData(initialData);
  }

  // Backup functionality
  createBackup() {
    const data = this.getData();
    const backup = {
      ...data,
      backupDate: new Date().toISOString(),
      version: '1.0'
    };
    
    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `service-support-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  restoreBackup(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const backup = JSON.parse(e.target.result);
          this.saveData(backup);
          resolve(backup);
        } catch (error) {
          reject(new Error('Invalid backup file format'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read backup file'));
      reader.readAsText(file);
    });
  }
}

// Create a singleton instance
export const storage = new ServiceSupportStorage();

// Export the class for potential direct usage
export default ServiceSupportStorage;

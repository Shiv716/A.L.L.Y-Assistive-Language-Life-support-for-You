/**
 * Configuration page logic for Vesta
 * Handles the setup/configuration interface
 */

class VestaConfig {
    constructor() {
        this.api = new VestaAPI();
        this.form = document.getElementById('configForm');
        this.saveStatus = document.getElementById('saveStatus');
        
        this.initializeForm();
        this.loadExistingConfig();
    }

    initializeForm() {
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        // Add reminder button
        const addReminderBtn = document.getElementById('addReminderBtn');
        addReminderBtn.addEventListener('click', () => this.addReminderItem());
        
        // Initial reminder removal handlers
        this.attachReminderRemovalHandlers();
    }

    async loadExistingConfig() {
        try {
            const config = await this.api.getConfig();
            this.populateForm(config);
        } catch (error) {
            console.error('Error loading config:', error);
            this.showStatus('Error loading existing configuration', 'error');
        }
    }

    populateForm(config) {
        // Basic user info
        if (config.userName) {
            document.getElementById('userName').value = config.userName;
        }
        if (config.context) {
            document.getElementById('context').value = config.context;
        }
        
        // Emergency contact
        if (config.emergencyContact) {
            document.getElementById('emergencyName').value = config.emergencyContact.name || '';
            document.getElementById('emergencyNumber').value = config.emergencyContact.number || '';
        }
        
        // Check-in frequency
        if (config.checkInFrequency) {
            document.getElementById('checkInFrequency').value = config.checkInFrequency;
        }
        
        // Reminders
        if (config.reminders && config.reminders.length > 0) {
            this.populateReminders(config.reminders);
        }
    }

    populateReminders(reminders) {
        const container = document.getElementById('remindersContainer');
        
        // Clear existing reminders
        container.innerHTML = '';
        
        // Add each reminder
        reminders.forEach(reminder => {
            this.addReminderItem(reminder.time, reminder.task);
        });
        
        // Add one empty reminder if none exist
        if (reminders.length === 0) {
            this.addReminderItem();
        }
    }

    addReminderItem(time = '09:00', task = '') {
        const container = document.getElementById('remindersContainer');
        
        const reminderDiv = document.createElement('div');
        reminderDiv.className = 'reminder-item';
        
        reminderDiv.innerHTML = `
            <div class="form-group">
                <label>Time:</label>
                <input type="time" name="reminderTime" value="${time}">
            </div>
            <div class="form-group">
                <label>Medication/Task:</label>
                <input type="text" name="reminderTask" value="${task}" placeholder="e.g., Take your Amlodipine (heart pills)">
            </div>
            <button type="button" class="remove-reminder">Remove</button>
        `;
        
        container.appendChild(reminderDiv);
        this.attachReminderRemovalHandlers();
    }

    attachReminderRemovalHandlers() {
        const removeButtons = document.querySelectorAll('.remove-reminder');
        removeButtons.forEach(button => {
            button.onclick = (e) => {
                e.target.closest('.reminder-item').remove();
            };
        });
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        try {
            const configData = this.extractFormData();
            
            // Validate required fields
            if (!this.validateConfig(configData)) {
                return;
            }
            
            // Save configuration
            await this.api.saveConfig(configData);
            this.showStatus('Configuration saved successfully!', 'success');
            
            // Optionally redirect after a delay
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            
        } catch (error) {
            console.error('Error saving config:', error);
            this.showStatus('Error saving configuration: ' + error.message, 'error');
        }
    }

    extractFormData() {
        const formData = new FormData(this.form);
        
        // Extract basic fields
        const config = {
            userName: formData.get('userName').trim(),
            context: formData.get('context').trim(),
            emergencyContact: {
                name: formData.get('emergencyName').trim(),
                number: formData.get('emergencyNumber').trim()
            },
            checkInFrequency: parseInt(formData.get('checkInFrequency')),
            reminders: []
        };
        
        // Extract reminders
        const reminderTimes = formData.getAll('reminderTime');
        const reminderTasks = formData.getAll('reminderTask');
        
        for (let i = 0; i < reminderTimes.length; i++) {
            const time = reminderTimes[i];
            const task = reminderTasks[i];
            
            if (time && task.trim()) {
                config.reminders.push({
                    time: time,
                    task: task.trim()
                });
            }
        }
        
        return config;
    }

    validateConfig(config) {
        const errors = [];
        
        if (!config.userName) {
            errors.push('User name is required');
        }
        
        if (!config.context) {
            errors.push('Personal context is required');
        }
        
        if (!config.emergencyContact.name) {
            errors.push('Emergency contact name is required');
        }
        
        if (!config.emergencyContact.number) {
            errors.push('Emergency contact phone number is required');
        } else if (!this.isValidPhoneNumber(config.emergencyContact.number)) {
            errors.push('Please enter a valid phone number (e.g., +447911123456)');
        }
        
        if (errors.length > 0) {
            this.showStatus('Please fix the following errors:\n' + errors.join('\n'), 'error');
            return false;
        }
        
        return true;
    }

    isValidPhoneNumber(phone) {
        // Basic phone validation - should start with + and contain only digits, spaces, and hyphens
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
        return phoneRegex.test(cleanPhone);
    }

    showStatus(message, type) {
        this.saveStatus.textContent = message;
        this.saveStatus.className = `save-status show ${type}`;
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.saveStatus.classList.remove('show');
        }, 5000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.vestaConfig = new VestaConfig();
});

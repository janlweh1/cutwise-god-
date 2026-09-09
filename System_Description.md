_Walks of Life_ 

## **OTTO** 

# **QR-Based Material Tracker** 

### **SYSTEM DESCRIPTION** 

### **Background** 

The QR-Based Material Tracker is an emerging technology backend module designed to improve the tracking and management of leftover leather materials. It combines QR code technology, a centralized database, and activity reports to make scrap records easier to identify, retrieve, update, and monitor. 

The module generates a unique QR code for every registered scrap record. When the code is scanned, it retrieves the latest authorized information about the material, including its type, dimensions, quantity, condition, location, and current status. It also records scan activities, system requests, and record updates for traceability. The module functions as a backend service and does not require a separate user-facing system. 

### **Purpose** 

The QR-Based Material Tracker aims to reduce delays and inconsistencies in managing leftover leather by providing QR-based traceability, accurate records, and faster material retrieval. 

### **Objectives** 

- Generate and manage unique QR codes for registered scraps. 

- Retrieve authorized scrap information through QR scanning. 

- Store and update the type, dimensions, quantity, condition, location, and status of each scrap. 

- Record scan events, system requests, and status updates for traceability. 

- Provide summary reports that support material reuse and waste-reduction decisions. 

### **Scope** 

The scope covers backend API endpoints, QR code generation and scanning, the backend database, record retrieval and updates, summary reports, validation, activity logging, and integration testing. 

### **Limitations** 

- The module depends on complete and accurate data supplied by Scrap Management. 

- Only authorized users and connected services may access protected material records. 

- The module does not manage sales, leather cutting, delivery, user-facing scrap workflows, or physical disposal activities. 

### **Expected Output** 

A working QR-based backend with a connected database, sample API responses, generated QR codes, record retrieval and update functions, test results, and integration documentation. 

_OTTO • QR-Based Material Tracker • Page 1_ 


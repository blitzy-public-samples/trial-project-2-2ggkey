---
name: Bug Report
about: Create a detailed bug report to help us improve the system
title: ''
labels: bug, triage-needed
assignees: ''
---

<!-- 
Please fill out this template as completely as possible to help us investigate and fix the issue.
Fields marked with * are required.
-->

## Bug Description*

### Title*
<!-- Provide a clear and concise description of the bug (under 100 characters) -->

### Component*
<!-- Select the affected system component -->
- [ ] Frontend/UI
- [ ] Task Service
- [ ] Auth Service
- [ ] File Service
- [ ] Notification Service
- [ ] API Gateway
- [ ] Database
- [ ] Infrastructure
- [ ] Cache Layer
- [ ] Message Queue

### Severity*
<!-- Select the appropriate severity level -->
- [ ] Critical - System Unusable (P0)
- [ ] High - Major Feature Impact (P1)
- [ ] Medium - Minor Feature Impact (P2)
- [ ] Low - Cosmetic Issue (P3)

## Environment*

### Environment Type*
<!-- Select the environment where the bug was found -->
- [ ] Production
- [ ] Staging
- [ ] Development
- [ ] Local

### Version Information*
- Application Version*: <!-- e.g., v1.2.3 -->
- Browser (if applicable): <!-- e.g., Chrome 90.0.4430.212 -->
- OS (if applicable): <!-- e.g., Windows 11 Pro 21H2 -->
- Deployment ID (if known): <!-- e.g., deploy-2023-10-25-001 -->

## Reproduction Steps*

### Prerequisites
<!-- List any required setup, data, or conditions needed to reproduce the issue -->

### Steps to Reproduce*
1. 
2. 
3. 
<!-- Add more steps as needed -->

### Expected Behavior*
<!-- Describe what should happen when the steps are followed -->

### Actual Behavior*
<!-- Describe what actually happens when the steps are followed -->

## Technical Details

### Error Logs
<details>
<summary>Expand to view logs</summary>

```
<!-- Paste relevant error logs, stack traces, or console output here -->
```
</details>

### Screenshots
<!-- Drag and drop screenshots or screen recordings here (max 10MB per file) -->

### Performance Metrics
<details>
<summary>Expand to view metrics</summary>

```
<!-- Include any relevant performance metrics or monitoring data -->
```
</details>

### Related Issues
<!-- Link to any related issues or pull requests -->

<!-- 
Auto-assignment will be handled based on the selected component:
Frontend/UI -> @frontend-team
Task Service -> @backend-team, @java-experts
Auth Service -> @backend-team, @security-team
File Service -> @backend-team, @go-experts
Notification Service -> @backend-team, @python-experts
Infrastructure -> @devops-team
-->
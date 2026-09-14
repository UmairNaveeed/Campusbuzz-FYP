// Add interactivity if needed
document.addEventListener('DOMContentLoaded', function() {
    // Tab switching
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Post button activation
    const composerInput = document.querySelector('.composer-input');
    const postBtn = document.querySelector('.post-btn');
    
    if (composerInput && postBtn) {
        composerInput.addEventListener('input', function() {
            if (this.value.trim().length > 0) {
                postBtn.style.opacity = '1';
            } else {
                postBtn.style.opacity = '0.4';
            }
        });
    }

    // Action buttons hover effects
    const actionButtons = document.querySelectorAll('.action-btn');
    actionButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            // Add interaction feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 100);
        });
    });
});

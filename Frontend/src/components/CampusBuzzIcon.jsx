import React from 'react';

const CampusBuzzIcon = ({ className = "w-8 h-8", fill = "currentColor" }) => {
  return (
    <svg 
      className={className} 
      viewBox="0 0 28 28" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Main building structure representing Campus */}
      <path 
        d="M14 2L4 8V26H8V14H12V26H16V14H20V26H24V8L14 2Z" 
        fill={fill}
      />
      {/* Windows on the building */}
      <rect x="6" y="10" width="2" height="2" fill="white" opacity="0.8"/>
      <rect x="10" y="10" width="2" height="2" fill="white" opacity="0.8"/>
      <rect x="16" y="10" width="2" height="2" fill="white" opacity="0.8"/>
      <rect x="20" y="10" width="2" height="2" fill="white" opacity="0.8"/>
      
      {/* Chat/Speech bubble representing Buzz/Social interaction */}
      <path 
        d="M20 18C21.1046 18 22 18.8954 22 20V22C22 23.1046 21.1046 24 20 24H18L16 26V24H14C12.8954 24 12 23.1046 12 22V20C12 18.8954 12.8954 18 14 18H20Z" 
        fill={fill}
        opacity="0.9"
      />
      {/* Dot in chat bubble */}
      <circle cx="17" cy="21" r="1" fill="white"/>
      <circle cx="19" cy="21" r="1" fill="white"/>
    </svg>
  );
};

export default CampusBuzzIcon;

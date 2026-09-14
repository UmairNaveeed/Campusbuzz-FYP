import React from 'react';
import CampusTrendsWidget from './CampusTrendsWidget';
import WhoToFollowWidget from './WhoToFollowWidget';

const RightSidebar = () => {
  return (
    <aside className="hidden xl:block xl:w-[330px] shrink-0">
      <div className="sticky top-[92px] space-y-4">
        <CampusTrendsWidget />
        <WhoToFollowWidget />
      </div>
    </aside>
  );
};

export default RightSidebar;

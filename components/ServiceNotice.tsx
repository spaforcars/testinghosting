import React, { useEffect, useState } from 'react';

const ServiceNotice: React.FC = () => {
  const [notice, setNotice] = useState(
    'Complimentary pick-up & drop off available (within close radius of the store only)'
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/cms/page?slug=settings');
        if (!response.ok) return;
        const payload = (await response.json()) as { data?: { serviceNotice?: string } };
        const nextNotice = payload.data?.serviceNotice;
        if (active && nextNotice) {
          setNotice(nextNotice);
        }
      } catch {
        // Keep fallback notice.
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="border-t border-black/[0.06] bg-white px-4 py-5 text-center">
      <p className="text-sm text-gray-600">
        {notice}
      </p>
    </div>
  );
};

export default ServiceNotice;

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const titles = {
  '/': 'Dashboard - Saiya MFG',
  '/scheduling': 'Scheduling - Saiya MFG',
  '/reports': 'Reports - Saiya MFG',
  '/bd-generator': 'BD Generator - Saiya MFG',
  '/parts-inbound': 'Parts Inbound - Saiya MFG',
  '/parts-outbound': 'Parts Outbound - Saiya MFG',
  '/cutting-input': 'Cutting Input - Saiya MFG',
  '/cutting-result': 'Cutting Result - Saiya MFG',
  '/breakdown-master-update': 'Breakdown Master Update - Saiya MFG',
  '/breakdown-bc': 'Breakdown BC - Saiya MFG',  
};

export default function PageTitle() {
  const location = useLocation();

  useEffect(() => {
    const currentTitle = titles[location.pathname] || 'Saiya MFG';
    document.title = currentTitle;
  }, [location]);

  return null;
}
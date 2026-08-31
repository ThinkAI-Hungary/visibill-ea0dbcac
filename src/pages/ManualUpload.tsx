import React from 'react';
import { ManualUploadFeature } from '@/features/upload';

/**
 * ManualUpload Page Facade.
 * Delegates entirely to the modular ManualUploadFeature in src/features/upload/.
 * Maintains 100% route and URL compatibility (/:companyId/:dateRange/upload/:tab?).
 */
const ManualUpload = () => {
  return <ManualUploadFeature />;
};

export default ManualUpload;
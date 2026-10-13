import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PostingWizardView } from '@/features/posting-wizard/components/PostingWizardView';

export default function PostingWizardPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl page-animate">
      <PostingWizardView
        companyId={companyId}
        onExit={() => navigate(-1)}
      />
    </div>
  );
}

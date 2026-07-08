import { AdminTableSkeleton } from '@/components/admin/AdminSkeletons.jsx';

export default function Loading() {
  return (
    <div className="admin-page odin-content-page">
      <AdminTableSkeleton rows={4} withToolbar />
    </div>
  );
}

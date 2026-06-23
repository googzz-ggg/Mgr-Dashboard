// app/dashboard/top-shops.tsx  (or your existing page/component)
'use client';

import { DataTable } from '@/components/ui/data-table-virtual';

type Shop = {
  rank: number;
  name: string;
  sales: number;
  area: string;
  attendance: number;
  // ... add more fields
};

const columns: ColumnDef<Shop>[] = [
  { accessorKey: 'rank', header: 'Rank' },
  { accessorKey: 'name', header: 'Shop Name' },
  {
    accessorKey: 'sales',
    header: 'Sales',
    cell: ({ row }) => `$${row.original.sales.toLocaleString()}`,
  },
  { accessorKey: 'area', header: 'Area' },
  { accessorKey: 'attendance', header: 'Attendance' },
];

export default function TopShopsPage({ shops }: { shops: Shop[] }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Top 20 Shops</h2>
      <DataTable columns={columns} data={shops} height="650px" />
    </div>
  );
}
export const CHANGELOG_DATA = [
  {
    version: '1.0.2',
    date: '2026-10-31',
    title: 'Modul Cutting Input & Download Result',
    changes: [
      { text: 'Cutting Input: Penambahan fiture cutting input dengan mengambil data dari db2 Beone system ' },
      { text: 'Cutting Result: Penambahan fiture cutting Result untuk mendownload hasil pemotongan' }
      
    ]
  },
  {
    version: '1.0.1',
    date: '2026-10-15',
    title: 'Peningkatan UI Navbar & Fab Remain Picking Report',
    changes: [
      { text: 'Fab Remain Picking Profile: Pemantauan real-time selisih kebutuhan vs transfer profil dari PostgreSQL.' },
      { text: 'Multi-level dropdown navigasi responsif dengan dukungan Dark & Light theme.' },
      { text: 'Pencatatan Audit Log global untuk setiap sesi dan interaksi user.' }
    ]
  },
  {
    version: '1.0.0',
    date: '2026-09-01',
    title: 'Rilis Perdana SAIYAMFG Production Suite',
    changes: [
      { text: 'Autentikasi User & Role Based Access Control (Admin, PPIC, Production, MT).' },
      { text: 'Breakdown Generator & Breakdown Testing (BC PostgreSQL & Shiage SQL Server).' },
      { text: 'Modul Parts Inbound & Outbound control.' }
    ]
  }
];
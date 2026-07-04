import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function AdminDashboard() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => setMe(data));
  }, []);

  return (
    <div>
      <h1>Dashboard Admin</h1>
      {me && <p>Masuk sebagai {me.nama}</p>}
    </div>
  );
}

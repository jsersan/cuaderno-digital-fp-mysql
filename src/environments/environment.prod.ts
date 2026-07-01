export const environment = {
  production: true,
  // En producción apunta a la API desplegada (mismo dominio/subcarpeta).
  apiUrl: 'https://txemaserrano.com/cuaderno-backend/index.php',
  appConfig: {
    comunidad: 'Euskadi',
    sistemaEducativo: 'Formación Profesional',
    evaluaciones: ['1ª Evaluación', '2ª Evaluación', '3ª Evaluación', 'Ordinaria', 'Extraordinaria'],
    cursoAcademico: '2025-2026',
    notaMinAprobado: 5,
    notaMaxima: 10,
    porcentajeAsistenciaMinimo: 85
  }
};

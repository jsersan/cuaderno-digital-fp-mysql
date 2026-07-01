export const environment = {
  production: false,
  // URL base de la API REST (backend PHP en MAMP). Apache de MAMP suele ser 8888.
  // Ajusta la ruta a donde copies la carpeta backend-php dentro de htdocs.
  apiUrl: 'http://localhost:8888/angular20/cuaderno-digital-fp-mysql/backend-php/index.php',
  appConfig: {
    comunidad: 'Euskadi',
    sistemaEducativo: 'Formación Profesional',
    evaluaciones: ['1ª Evaluación', '2ª Evaluación', '1ª Evaluación Final', '2ª Evaluación Final'],
    cursoAcademico: '2025-2026',
    notaMinAprobado: 5,
    notaMaxima: 10,
    porcentajeAsistenciaMinimo: 85
  }
};

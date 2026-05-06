exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DB_ID = process.env.NOTION_DB_ID;

  if (!NOTION_TOKEN || !DB_ID) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: '환경변수 없음' }) };
  }

  try {
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      const student = params.student || '';
      const filter = student ? {
        filter: { property: '학생', select: { equals: student } }
      } : {};
      const res = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...filter,
          sorts: [{ property: '날짜', direction: 'descending' }],
          page_size: 100
        })
      });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      const { student, date, results, parentMsg } = body;
      const statusMap = { good: '잘함', mid: '보통', bad: '개선필요' };
      const saved = [];
      for (const r of results) {
        const res = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            parent: { database_id: DB_ID },
            properties: {
              '이름': { title: [{ text: { content: `${student} · ${r.text}` } }] },
              '학생': { select: { name: student } },
              '날짜': { date: { start: date } },
              '영역': { select: { name: r.section } },
              '항목': { rich_text: [{ text: { content: r.text } }] },
              '목표코드': { rich_text: [{ text: { content: r.code || '' } }] },
              '상태': { select: { name: statusMap[r.state] || '보통' } },
              '메모': { rich_text: [{ text: { content: parentMsg || '' } }] },
            }
          })
        });
        const data = await res.json();
        saved.push(data);
      }
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, count: saved.length }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

import type { EmployeeType, ItemType, WorkstationConfig, WorkstationItem, WorkstationState } from '../types/workstation';

const recipes: { type: ItemType; name: string; employee: EmployeeType; employeeName: string; stages: string }[] = [
  { type: 'document', name: '文件', employee: 'intern', employeeName: '困困猫', stages: '1–3' },
  { type: 'coffee', name: '咖啡', employee: 'junior', employeeName: '续命蛙', stages: '4–6' },
  { type: 'package', name: '快递', employee: 'senior', employeeName: '打卡汪', stages: '7–8' }
];

// 高级材料按合成份量折算，只统计已经领入收件箱或桌面的真实材料。
export function workstationGrowth(state: WorkstationState, config: WorkstationConfig) {
  const materials: WorkstationItem[] = [...state.inbox];
  const employees = new Set<EmployeeType>();
  let employeeCount = 0;
  let hourlyCoins = 0;
  const desks = state.desks;
  for (let i = 0; i < desks.length; i++) {
    const content = desks[i].content;
    if (!content) continue;
    if ('producedCoins' in content) {
      employees.add(content.type);
      employeeCount++;
      hourlyCoins += config.employeeProduction[content.type].coinsPerHour;
    } else {
      materials.push(content);
    }
  }

  let selected = recipes[0];
  let progress = -1;
  const missing = recipes.filter(recipe => !employees.has(recipe.employee));
  const candidates = missing.length > 0 ? missing : recipes;
  for (let i = 0; i < candidates.length; i++) {
    const recipe = candidates[i];
    const maxLevel = config.itemLevels[recipe.type].maxLevel;
    let units = 0;
    for (let j = 0; j < materials.length; j++) {
      if (materials[j].type === recipe.type) units += 2 ** (Math.min(maxLevel, materials[j].level) - 1);
    }
    const amount = Math.min(1, units / 2 ** maxLevel);
    if (amount > progress) {
      selected = recipe;
      progress = amount;
    }
  }
  const maxLevel = config.itemLevels[selected.type].maxLevel;
  return {
    title: `下一位：${selected.employeeName}`,
    face: { intern: 1, junior: 4, senior: 5, lead: 7, manager: 10 }[selected.employee],
    recipe: `两份 ${maxLevel} 级${selected.name} → ${selected.employeeName} · 普通 ${selected.stages} 关收集`,
    progress,
    status: `材料进度 ${Math.floor(progress * 100)}% · 已入职 ${employeeCount} 位 · 产出 ${hourlyCoins} 币/时`
  };
}

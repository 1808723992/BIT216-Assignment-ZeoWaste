<?php
session_start();
if (!isset($_SESSION['user_id'])) {
    header('Location: ../LoginAndRegistry/sign_in.html');
    exit();
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Weekly Meal Planner</title>
	<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
	<link rel="stylesheet" href="../Homepage/nav.css" onerror="console.error('Failed to load nav.css from:', this.href);">
	<link rel="stylesheet" href="meal_planner.css">
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0">
</head>
<body>
	<script>
		// 加载导航（适配子目录路径）
		(function () {
			const placeholder = document.createElement("div");
			placeholder.id = "nav-placeholder";
			document.body.insertBefore(placeholder, document.body.firstChild);
			
			fetch("../nav.html")
				.then(res => {
					if (!res.ok) throw new Error("无法加载 nav.html");
					return res.text();
				})
				.then(html => {
					// 修复路径：将相对路径改为从根目录开始的路径
					html = html.replace(/src="HomePagePicture\//g, 'src="../HomePagePicture/');
					html = html.replace(/href="([^"]+)"/g, (match, href) => {
						// 修复链接路径（除了外部链接）
						if (href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:')) {
							return match;
						}
						// 如果链接不是以 ../ 开头，添加 ../
						if (!href.startsWith('../') && !href.startsWith('/')) {
							return `href="../${href}"`;
						}
						return match;
					});
					
					placeholder.innerHTML = html;
					
					// 移除任何错误的 nav.css 引用（可能来自其他脚本）
					document.querySelectorAll('link[href*="nav.css"]').forEach(link => {
						if (link.href.includes('/Main/nav.css') || link.href.endsWith('/nav.css')) {
							console.log('Removing incorrect nav.css link:', link.href);
							link.remove();
						}
					});
					
					// 确保正确的 nav.css 已加载
					const correctNavCss = document.querySelector('link[href*="Homepage/nav.css"]');
					if (!correctNavCss) {
						const link = document.createElement("link");
						link.rel = "stylesheet";
						link.href = "../Homepage/nav.css";
						link.onerror = () => console.error('❌ Failed to load nav.css from:', link.href, 'Current page:', window.location.pathname);
						link.onload = () => console.log('✅ nav.css loaded successfully from:', link.href);
						document.head.appendChild(link);
					} else {
						console.log('✅ nav.css already exists in head:', correctNavCss.href);
					}
					
					console.log("✅ ZeoWaste 导航栏加载成功");
					waitForNavElements();
				})
				.catch(err => console.error("❌ 导航加载失败:", err));
			
			function waitForNavElements(retry = 0) {
				const appBtn = document.getElementById("appLauncherBtn");
				const appDropdown = document.getElementById("appDropdown");
				const profileBtn = document.getElementById("profileBtn");
				const profileDropdown = document.getElementById("profileDropdown");
				
				if (appBtn && appDropdown) {
					bindNavEvents(appBtn, appDropdown, profileBtn, profileDropdown);
					console.log("✅ ZeoWaste App Launcher 事件已绑定完成");
				} else if (retry < 20) {
					setTimeout(() => waitForNavElements(retry + 1), 250);
				} else {
					console.error("❌ 超过重试次数，App launcher 未找到。");
				}
			}
			
			function bindNavEvents(appBtn, appDropdown, profileBtn, profileDropdown) {
				appBtn.addEventListener("click", e => {
					e.stopPropagation();
					if (profileDropdown) profileDropdown.style.display = "none";
					appDropdown.style.display = appDropdown.style.display === "block" ? "none" : "block";
				});
				
				if (profileBtn && profileDropdown) {
					profileBtn.addEventListener("click", e => {
						e.stopPropagation();
						if (appDropdown) appDropdown.style.display = "none";
						profileDropdown.style.display = profileDropdown.style.display === "block" ? "none" : "block";
					});
				}
				
				document.addEventListener("click", e => {
					if (!e.target.closest(".app-launcher") && !e.target.closest(".profile-menu")) {
						appDropdown.style.display = "none";
						if (profileDropdown) profileDropdown.style.display = "none";
					}
				});
				
				appDropdown.addEventListener("click", e => e.stopPropagation());
				if (profileDropdown) profileDropdown.addEventListener("click", e => e.stopPropagation());
			}
		})();
	</script>
	<div class="main">
		<div class="header">
			<div class="header-left">
				<h1 class="title-brand">Weekly Meal Planner</h1>
			</div>
			<div class="header-right">
				<span id="prev-week" class="period link dot">Prev</span>
				<span id="period-text" class="period">2025/10/27 – 2025/11/02</span>
				<span id="next-week" class="period link dot-right">Next</span>
				<button id="confirm-plan" class="btn primary" disabled>Confirm Weekly Plan</button>
			</div>
		</div>

		<div class="grid-wrap">
			<div class="board">
				<div class="board-head">
					<span class="period">Week View</span>
				</div>
				<table class="table">
					<thead>
						<tr>
							<th class="slot-label"></th>
							<th class="day-head">
								<div class="day-title"><span class="dow">Mon</span><span class="date" data-day-offset="0">—</span></div>
							</th>
							<th class="day-head">
								<div class="day-title"><span class="dow">Tue</span><span class="date" data-day-offset="1">—</span></div>
							</th>
							<th class="day-head">
								<div class="day-title"><span class="dow">Wed</span><span class="date" data-day-offset="2">—</span></div>
							</th>
							<th class="day-head">
								<div class="day-title"><span class="dow">Thu</span><span class="date" data-day-offset="3">—</span></div>
							</th>
							<th class="day-head">
								<div class="day-title"><span class="dow">Fri</span><span class="date" data-day-offset="4">—</span></div>
							</th>
							<th class="day-head">
								<div class="day-title"><span class="dow">Sat</span><span class="date" data-day-offset="5">—</span></div>
							</th>
							<th class="day-head">
								<div class="day-title"><span class="dow">Sun</span><span class="date" data-day-offset="6">—</span></div>
							</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td class="slot-label">Breakfast</td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
						</tr>
						<tr>
							<td class="slot-label">Lunch</td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
						</tr>
						<tr>
							<td class="slot-label">Dinner</td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
						</tr>
						<tr>
							<td class="slot-label">Snacks</td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
							<td class="cell"><span class="add-link">+ Add</span></td>
						</tr>
					</tbody>
				</table>
			</div>

			<aside class="sidebar">
				<h3>Recipes</h3>
				<div class="search">
					<input id="recipe-search" type="text" placeholder="Search recipe...">
				</div>
				<div class="section-title">Ordered by match: Fully － Partial － Not</div>
				<div class="recipe-list">
					<div class="recipe">
						<div class="tags">
							<span>DINNER</span>
							<span class="badge success">FULLY</span>
						</div>
						<div class="ingredients">10 ingredients</div>
						<div class="actions">
							<button class="btn ghost" data-action="details">Details</button>
						</div>
					</div>

					<div class="recipe">
						<div class="tags">
							<span>BREAKFAST</span>
							<span class="badge success">FULLY</span>
						</div>
						<div class="ingredients">4 ingredients</div>
						<div class="actions">
							<button class="btn ghost" data-action="details">Details</button>
						</div>
					</div>

					<div class="recipe">
						<div class="tags">
							<span>SNACKS</span>
							<span class="badge danger">NOT</span>
						</div>
						<div class="ingredients">5 ingredients</div>
						<div class="actions">
							<button class="btn ghost" data-action="details">Details</button>
						</div>
					</div>

					<div class="recipe">
						<div class="tags">
							<span>LUNCH</span>
							<span class="badge warn">PARTIAL</span>
						</div>
						<div class="ingredients">7 ingredients</div>
						<div class="actions">
							<button class="btn ghost" data-action="details">Details</button>
						</div>
					</div>
				</div>
			</aside>
		</div>

		<!-- Add New Recipe Editor -->
		<div class="re-card" id="re-card">
			<button class="re-toggle" id="re-toggle"><span class="re-plus">+</span><span>Add New Recipe</span><span class="re-caret">▾</span></button>
			<div class="re-body" id="re-body" hidden>
				<div class="re-row">
					<label class="re-label">Recipe Name</label>
					<input type="text" id="re-name" class="re-input" placeholder="e.g., Greek Salad">
				</div>
				<div class="re-row">
					<label class="re-label">Category</label>
					<select id="re-category" class="re-input">
						<option>Breakfast</option>
						<option selected>Lunch</option>
						<option>Dinner</option>
						<option>Snacks</option>
					</select>
				</div>
				<div class="re-row">
					<label class="re-label">Ingredients</label>
					<div id="re-ing-lines" class="re-ing-lines">
						<div class="re-ing-line">
							<input type="text" class="re-input re-ing-name" placeholder="Ingredient name">
							<input type="text" class="re-input small re-ing-amount" placeholder="Amount">
							<button class="btn ghost re-remove-line" title="Remove" aria-label="Remove line">×</button>
						</div>
					</div>
					<div class="re-ing-actions">
						<button class="btn ghost" id="re-add-line">+ Add</button>
					</div>
				</div>
				<div class="re-row">
					<label class="re-label">Nutrition (per serving)</label>
					<div class="re-grid4">
						<input type="text" id="re-cal" class="re-input" placeholder="Cal"><span class="re-unit">kcal</span>
						<input type="text" id="re-protein" class="re-input" placeholder="Protein"><span class="re-unit">g</span>
						<input type="text" id="re-fat" class="re-input" placeholder="Fat"><span class="re-unit">g</span>
						<input type="text" id="re-carbs" class="re-input" placeholder="Carbs"><span class="re-unit">g</span>
					</div>
				</div>
				<div class="re-actions">
					<button class="btn primary" id="re-submit">Add Recipe</button>
					<button class="btn ghost" id="re-cancel">Cancel</button>
				</div>
			</div>
		</div>

	</div>

	<!-- Details Modal -->
	<div id="meal-modal" class="mm-overlay" aria-hidden="true">
		<div class="mm-dialog" role="dialog" aria-modal="true">
			<button class="mm-close" aria-label="Close">×</button>
			<div class="mm-header">
				<h2 id="mm-title">Spaghetti Bolognese</h2>
				<div class="mm-tags">
					<span class="badge success" id="mm-type">DINNER</span>
					<span class="badge warn" id="mm-match">PARTIAL</span>
				</div>
			</div>
			<div class="mm-section">
				<h3>Ingredients (required vs. available)</h3>
				<table class="mm-table">
					<thead>
						<tr>
							<th>Ingredient</th>
							<th>Required</th>
							<th>Available</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody id="mm-ingredients"></tbody>
				</table>
			</div>
			<div class="mm-grid">
				<div class="mm-section">
					<h3>Nutrition Info (per serving)</h3>
					<div class="mm-nutri">
						<div><span>Calories:</span> <strong id="mm-calories">450 kcal</strong></div>
						<div><span>Protein:</span> <strong id="mm-protein">25 g</strong></div>
						<div><span>Fat:</span> <strong id="mm-fat">15 g</strong></div>
						<div><span>Carbs:</span> <strong id="mm-carbs">52 g</strong></div>
					</div>
				</div>
				<div class="mm-section">
					<h3>Add to Meal Planner</h3>
					<div class="mm-form">
						<label>
							<span>Date</span>
							<input type="date" id="mm-date">
						</label>
						<label>
							<span>Meal Slot</span>
							<select id="mm-slot">
								<option>Breakfast</option>
								<option selected>Lunch</option>
								<option>Dinner</option>
								<option>Snacks</option>
							</select>
						</label>
					</div>
					<button class="btn primary" id="mm-add">Add</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Recipe Picker Modal -->
	<div id="picker-modal" class="mm-overlay" aria-hidden="true">
		<div class="mm-dialog picker" role="dialog" aria-modal="true">
			<button class="mm-close" aria-label="Close">×</button>
			<div class="mm-header">
				<div>
					<h2 style="margin-bottom:4px;">Select a Recipe</h2>
					<div class="period">Choose a recipe to add to your meal plan.</div>
				</div>
			</div>
			<div class="picker-list" id="picker-list"></div>
		</div>
	</div>

	<!-- Missing Ingredients Modal -->
	<div id="missing-ingredients-modal" class="mm-overlay" aria-hidden="true">
		<div class="mm-dialog" role="dialog" aria-modal="true" style="width: min(650px, 96%);">
			<button class="mm-close" aria-label="Close" id="missing-ingredients-close">×</button>
			<div class="mm-header">
				<h2 id="missing-recipe-name">Cannot Add Recipe</h2>
				<div class="warning-badge">
					Insufficient ingredients in inventory
				</div>
			</div>
			<div class="mm-section">
				<h3>Missing Ingredients</h3>
				<div id="missing-ingredients-list">
					<!-- Missing ingredients will be inserted here -->
				</div>
			</div>
			<div class="modal-footer">
				<button class="btn primary" id="missing-ingredients-ok">Got it</button>
			</div>
		</div>
	</div>

	<!-- Edit Recipe Modal -->
	<div id="edit-modal" class="mm-overlay" aria-hidden="true">
		<div class="mm-dialog" role="dialog" aria-modal="true">
			<button class="mm-close" aria-label="Close">×</button>
			<div class="mm-header">
				<h2 id="edit-title">Edit Recipe</h2>
			</div>
			<div class="mm-section">
				<div class="re-row">
					<label class="re-label">Recipe Name</label>
					<input type="text" id="em-name" class="re-input" placeholder="Recipe name">
				</div>
				<div class="re-row">
					<label class="re-label">Category</label>
					<select id="em-category" class="re-input">
						<option>BREAKFAST</option>
						<option selected>LUNCH</option>
						<option>DINNER</option>
						<option>SNACKS</option>
					</select>
				</div>
				<div class="re-row">
					<label class="re-label">Ingredients</label>
					<div id="em-ing-lines" class="re-ing-lines">
						<div class="re-ing-line">
							<input type="text" class="re-input em-ing-name" placeholder="Ingredient name">
							<input type="text" class="re-input small em-ing-amount" placeholder="Amount">
							<button class="btn ghost em-remove-line" title="Remove" aria-label="Remove line">×</button>
						</div>
					</div>
					<div class="re-ing-actions">
						<button class="btn ghost" id="em-add-line">+ Add</button>
					</div>
				</div>
				<div class="re-row">
					<label class="re-label">Nutrition (per serving)</label>
					<div class="re-grid4">
						<input type="text" id="em-cal" class="re-input" placeholder="Cal"><span class="re-unit">kcal</span>
						<input type="text" id="em-protein" class="re-input" placeholder="Protein"><span class="re-unit">g</span>
						<input type="text" id="em-fat" class="re-input" placeholder="Fat"><span class="re-unit">g</span>
						<input type="text" id="em-carbs" class="re-input" placeholder="Carbs"><span class="re-unit">g</span>
					</div>
				</div>
				<div class="re-actions">
					<button class="btn primary" id="em-save">Save</button>
					<button class="btn ghost" id="em-cancel">Cancel</button>
				</div>
			</div>
		</div>
	</div>

	<script src="meal_planner.js"></script>
	
	<footer style="margin-top: 40px; padding: 20px; text-align: center; background: #f7f8fb; border-top: 1px solid #e5e7eb;">
		<p style="margin: 0 0 10px 0; color: #6b7280;">&copy; 2025 ZeoWaste. All Rights Reserved.</p>
		<div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;">
			<a href="#" style="color: #22c55e; text-decoration: none; font-size: 14px;">About Us</a>
			<a href="#" style="color: #22c55e; text-decoration: none; font-size: 14px;">Contact</a>
			<a href="#" style="color: #22c55e; text-decoration: none; font-size: 14px;">Privacy Policy</a>
		</div>
	</footer>
</body>
</html>


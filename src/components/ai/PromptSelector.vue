<template>
  <div class="prompt-selector">
    <!-- 顶部搜索和筛选 -->
    <div class="selector-header">
      <el-input
        v-model="searchQuery"
        placeholder="搜索提示词..."
        clearable
        @input="handleSearch"
        class="search-input"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <el-select
        v-model="selectedCategory"
        placeholder="分类筛选"
        clearable
        @change="handleCategoryChange"
        style="width: 150px"
      >
        <el-option label="全部" value="" />
        <el-option label="📝 总结类" value="summary" />
        <el-option label="🔍 搜索类" value="search" />
        <el-option label="📊 分析类" value="analysis" />
      </el-select>

      <el-segmented v-model="viewMode" :options="viewModeOptions" />

      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        新建提示词
      </el-button>
    </div>

    <!-- 快捷筛选标签 -->
    <div class="quick-filters">
      <el-tag
        :type="showFavorites ? 'primary' : 'info'"
        :effect="showFavorites ? 'dark' : 'plain'"
        @click="showFavorites = !showFavorites"
        class="filter-tag"
      >
        <el-icon><StarFilled v-if="showFavorites" /><Star v-else /></el-icon>
        收藏
      </el-tag>
      <el-tag
        :type="showBuiltIn ? 'primary' : 'info'"
        :effect="showBuiltIn ? 'dark' : 'plain'"
        @click="showBuiltIn = !showBuiltIn"
        class="filter-tag"
      >
        <el-icon><Box /></el-icon>
        内置
      </el-tag>
      <el-tag
        :type="showRecent ? 'primary' : 'info'"
        :effect="showRecent ? 'dark' : 'plain'"
        @click="showRecent = !showRecent"
        class="filter-tag"
      >
        <el-icon><Clock /></el-icon>
        最近使用
      </el-tag>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="5" animated />
    </div>

    <!-- 提示词列表 -->
    <div v-else-if="filteredPrompts.length > 0" class="prompt-list">
      <!-- 卡片视图 -->
      <div v-if="viewMode === 'card'" class="card-view">
        <div
          v-for="prompt in filteredPrompts"
          :key="prompt.id"
          class="prompt-card"
          :class="{ active: selectedPrompt?.id === prompt.id }"
          @click="handleSelectPrompt(prompt)"
        >
          <div class="card-header">
            <div class="title-row">
              <span class="icon">{{ prompt.icon || '📄' }}</span>
              <span class="title">{{ prompt.title }}</span>
            </div>
            <div class="actions">
              <el-icon
                :class="{ favorited: prompt.isFavorite }"
                @click.stop="toggleFavorite(prompt)"
              >
                <StarFilled v-if="prompt.isFavorite" />
                <Star v-else />
              </el-icon>
              <el-dropdown trigger="click" @click.stop>
                <el-icon><MoreFilled /></el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="handleEditPrompt(prompt)">
                      <el-icon><Edit /></el-icon>
                      编辑
                    </el-dropdown-item>
                    <el-dropdown-item @click="handleDuplicatePrompt(prompt)">
                      <el-icon><CopyDocument /></el-icon>
                      复制
                    </el-dropdown-item>
                    <el-dropdown-item
                      v-if="!prompt.isBuiltIn"
                      @click="handleDeletePrompt(prompt)"
                      divided
                    >
                      <el-icon><Delete /></el-icon>
                      删除
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <div class="card-body">
            <p class="description">{{ prompt.description }}</p>
            <div class="meta">
              <el-tag size="small" :type="getCategoryType(prompt.category)">
                {{ getCategoryLabel(prompt.category) }}
              </el-tag>
              <el-tag v-if="prompt.isBuiltIn" size="small" type="info">内置</el-tag>
              <span class="usage-count">
                <el-icon><View /></el-icon>
                {{ prompt.usageCount || 0 }}
              </span>
            </div>
            <div v-if="prompt.variables && prompt.variables.length > 0" class="variables">
              <el-icon><List /></el-icon>
              <span>{{ prompt.variables.length }} 个变量</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 列表视图 -->
      <div v-else class="list-view">
        <el-table
          :data="filteredPrompts"
          stripe
          highlight-current-row
          @row-click="handleSelectPrompt"
        >
          <el-table-column width="60" align="center">
            <template #default="{ row }">
              <span class="icon-large">{{ row.icon || '📄' }}</span>
            </template>
          </el-table-column>

          <el-table-column prop="title" label="标题" min-width="200">
            <template #default="{ row }">
              <div class="title-cell">
                <span class="title-text">{{ row.title }}</span>
                <el-tag v-if="row.isBuiltIn" size="small" type="info">内置</el-tag>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="description" label="描述" min-width="300" show-overflow-tooltip />

          <el-table-column prop="category" label="分类" width="120">
            <template #default="{ row }">
              <el-tag size="small" :type="getCategoryType(row.category)">
                {{ getCategoryLabel(row.category) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="变量" width="80" align="center">
            <template #default="{ row }">
              {{ row.variables?.length || 0 }}
            </template>
          </el-table-column>

          <el-table-column label="使用次数" width="100" align="center">
            <template #default="{ row }">
              {{ row.usageCount || 0 }}
            </template>
          </el-table-column>

          <el-table-column fixed="right" label="操作" width="120" align="center">
            <template #default="{ row }">
              <el-button
                link
                type="primary"
                size="small"
                @click.stop="toggleFavorite(row)"
              >
                <el-icon>
                  <StarFilled v-if="row.isFavorite" />
                  <Star v-else />
                </el-icon>
              </el-button>
              <el-button
                link
                type="primary"
                size="small"
                @click.stop="handleEditPrompt(row)"
              >
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button
                v-if="!row.isBuiltIn"
                link
                type="danger"
                size="small"
                @click.stop="handleDeletePrompt(row)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <el-empty :description="getEmptyDescription()">
        <el-button type="primary" @click="handleClearFilters">
          清除筛选条件
        </el-button>
      </el-empty>
    </div>

    <!-- 新建/编辑提示词对话框 -->
    <PromptEditor
      v-model="showCreateDialog"
      :prompt="editingPrompt"
      @saved="handlePromptSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search,
  Plus,
  Star,
  StarFilled,
  Box,
  Clock,
  MoreFilled,
  Edit,
  Delete,
  CopyDocument,
  View,
  List
} from '@element-plus/icons-vue'
import { usePromptStore } from '@/stores/ai/prompt'
import type { Prompt } from '@/types/ai'
import PromptEditor from './PromptEditor.vue'

interface Props {
  modelValue?: Prompt | null
  selectable?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: Prompt | null): void
  (e: 'select', prompt: Prompt): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  selectable: true
})

const emit = defineEmits<Emits>()

const promptStore = usePromptStore()

// UI 状态
const loading = ref(false)
const searchQuery = ref('')
const selectedCategory = ref('')
const viewMode = ref<'card' | 'list'>('card')
const showFavorites = ref(false)
const showBuiltIn = ref(false)
const showRecent = ref(false)
const selectedPrompt = ref<Prompt | null>(props.modelValue)
const showCreateDialog = ref(false)
const editingPrompt = ref<Prompt | null>(null)

// 视图模式选项
const viewModeOptions = [
  { label: '卡片', value: 'card' },
  { label: '列表', value: 'list' }
]

// 过滤后的提示词列表
const filteredPrompts = computed(() => {
  let prompts = promptStore.prompts || []

  // 分类筛选
  if (selectedCategory.value) {
    prompts = prompts.filter(p => p.category === selectedCategory.value)
  }

  // 收藏筛选
  if (showFavorites.value) {
    prompts = promptStore.favoritePrompts
  }

  // 内置筛选
  if (showBuiltIn.value) {
    prompts = promptStore.builtInPrompts
  }

  // 最近使用筛选
  if (showRecent.value) {
    prompts = promptStore.recentPrompts
  }

  // 搜索筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    prompts = prompts.filter(p => 
      p.title.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query) ||
      p.content.toLowerCase().includes(query)
    )
  }

  // 按使用次数排序
  return prompts.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
})

// 获取分类标签
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    summary: '总结',
    search: '搜索',
    analysis: '分析'
  }
  return labels[category] || category
}

// 获取分类类型（用于 tag 颜色）
function getCategoryType(category: string): 'success' | 'warning' | 'info' | undefined {
  const types: Record<string, 'success' | 'warning' | 'info'> = {
    summary: 'success',
    search: 'warning',
    analysis: 'info'
  }
  return types[category]
}

// 获取空状态描述
function getEmptyDescription(): string {
  if (searchQuery.value) {
    return `没有找到与 "${searchQuery.value}" 相关的提示词`
  }
  if (showFavorites.value) {
    return '暂无收藏的提示词'
  }
  if (showRecent.value) {
    return '暂无最近使用的提示词'
  }
  return '暂无提示词，点击"新建提示词"创建'
}

// 处理搜索
function handleSearch() {
  // 搜索已通过 computed 自动处理
}

// 处理分类变化
function handleCategoryChange() {
  // 筛选已通过 computed 自动处理
}

// 清除筛选条件
function handleClearFilters() {
  searchQuery.value = ''
  selectedCategory.value = ''
  showFavorites.value = false
  showBuiltIn.value = false
  showRecent.value = false
}

// 选择提示词
function handleSelectPrompt(prompt: Prompt) {
  if (!props.selectable) return
  
  selectedPrompt.value = prompt
  emit('update:modelValue', prompt)
  emit('select', prompt)
  
  // 记录使用
  promptStore.recordUsage(prompt.id!)
}

// 切换收藏
async function toggleFavorite(prompt: Prompt) {
  try {
    await promptStore.toggleFavorite(prompt.id!)
    ElMessage.success(prompt.isFavorite ? '已取消收藏' : '已收藏')
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

// 编辑提示词
function handleEditPrompt(prompt: Prompt) {
  editingPrompt.value = { ...prompt }
  showCreateDialog.value = true
}

// 复制提示词
async function handleDuplicatePrompt(prompt: Prompt) {
  try {
    const duplicated: Prompt = {
      ...prompt,
      id: undefined,
      title: `${prompt.title} (副本)`,
      isBuiltIn: false,
      isFavorite: false,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    await promptStore.savePrompt(duplicated)
    ElMessage.success('提示词已复制')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

// 删除提示词
async function handleDeletePrompt(prompt: Prompt) {
  if (prompt.isBuiltIn) {
    ElMessage.warning('内置提示词不能删除')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除提示词"${prompt.title}"吗？此操作不可恢复。`,
      '确认删除',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    )

    await promptStore.deletePrompt(prompt.id!)
    ElMessage.success('删除成功')

    // 如果删除的是当前选中的，清除选择
    if (selectedPrompt.value?.id === prompt.id) {
      selectedPrompt.value = null
      emit('update:modelValue', null)
    }
  } catch (error) {
    // 用户取消删除
  }
}

// 提示词保存后的回调
function handlePromptSaved(prompt: Prompt) {
  showCreateDialog.value = false
  editingPrompt.value = null
  ElMessage.success(prompt.id ? '保存成功' : '创建成功')
}

// 加载提示词列表
async function loadPrompts() {
  loading.value = true
  try {
    await promptStore.loadPrompts()
  } catch (error) {
    console.error('加载提示词失败:', error)
    ElMessage.error('加载提示词失败')
  } finally {
    loading.value = false
  }
}

// 组件挂载时初始化
onMounted(async () => {
  await promptStore.init()
  await loadPrompts()
})
</script>

<style scoped lang="scss">
.prompt-selector {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  height: 100%;
  overflow: hidden;

  .selector-header {
    display: flex;
    gap: 12px;
    align-items: center;

    .search-input {
      flex: 1;
      max-width: 400px;
    }
  }

  .quick-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;

    .filter-tag {
      cursor: pointer;
      user-select: none;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 4px;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
    }
  }

  .loading-state {
    flex: 1;
    padding: 20px 0;
  }

  .prompt-list {
    flex: 1;
    overflow-y: auto;

    .card-view {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;

      .prompt-card {
        padding: 16px;
        background-color: var(--el-bg-color);
        border: 2px solid var(--el-border-color);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          border-color: var(--el-color-primary);
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
          transform: translateY(-2px);
        }

        &.active {
          border-color: var(--el-color-primary);
          background-color: var(--el-color-primary-light-9);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;

          .title-row {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 1;

            .icon {
              font-size: 20px;
              flex-shrink: 0;
            }

            .title {
              font-size: 16px;
              font-weight: 600;
              color: var(--el-text-color-primary);
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
          }

          .actions {
            display: flex;
            gap: 8px;
            align-items: center;

            .el-icon {
              font-size: 18px;
              cursor: pointer;
              color: var(--el-text-color-secondary);
              transition: all 0.2s;

              &:hover {
                color: var(--el-color-primary);
                transform: scale(1.1);
              }

              &.favorited {
                color: var(--el-color-warning);
              }
            }
          }
        }

        .card-body {
          .description {
            margin: 0 0 12px 0;
            font-size: 13px;
            color: var(--el-text-color-regular);
            line-height: 1.6;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .meta {
            display: flex;
            gap: 8px;
            align-items: center;
            margin-bottom: 8px;
            flex-wrap: wrap;

            .usage-count {
              display: flex;
              align-items: center;
              gap: 4px;
              font-size: 12px;
              color: var(--el-text-color-secondary);
              margin-left: auto;
            }
          }

          .variables {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: var(--el-text-color-secondary);
          }
        }
      }
    }

    .list-view {
      .icon-large {
        font-size: 24px;
      }

      .title-cell {
        display: flex;
        align-items: center;
        gap: 8px;

        .title-text {
          font-weight: 500;
        }
      }

      :deep(.el-table__row) {
        cursor: pointer;
      }
    }
  }

  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
  }
}

// 响应式设计
@media (max-width: 768px) {
  .prompt-selector {
    padding: 12px;

    .selector-header {
      flex-direction: column;
      align-items: stretch;

      .search-input {
        max-width: 100%;
      }

      .el-select,
      .el-button {
        width: 100%;
      }
    }

    .prompt-list .card-view {
      grid-template-columns: 1fr;
    }
  }
}
</style>
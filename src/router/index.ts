import { createRouter, createWebHashHistory } from 'vue-router'
import AppLayout from '../components/layout/AppLayout.vue'
import WorkflowListView from '../components/flows/WorkflowListView.vue'
import VueFlowPage from '../components/flows/VueFlowPage.vue'
import ContextListView from '../components/context/ContextListView.vue'
import ContextDetailView from '../components/context/ContextDetailView.vue'
import ResourcesView from '../components/infra/ResourcesView.vue'
import SpacesView from '../components/infra/SpacesView.vue'
import SpaceDetailView from '../components/infra/SpaceDetailView.vue'
import ExtensionListView from '../components/extension/ExtensionListView.vue'
import ExtensionDetailView from '../components/extension/ExtensionDetailView.vue'
import PortalDetailView from '../components/infra/PortalDetailView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/debug-enum',
      component: () => import('../components/DebugEnum.vue'),
    },
    {
      path: '/',
      component: AppLayout,
      redirect: '/workflows',
      children: [
        {
          path: 'workflows',
          name: 'workflows',
          component: WorkflowListView,
        },
        {
          path: 'workflows/new',
          name: 'workflow-new',
          component: VueFlowPage,
        },
        {
          path: 'workflows/:id',
          name: 'workflow-edit',
          component: VueFlowPage,
          props: true,
        },
        {
          path: 'contexts',
          name: 'contexts',
          component: ContextListView,
        },
        {
          path: 'contexts/new',
          name: 'context-new',
          component: ContextDetailView,
        },
        {
          path: 'contexts/:id',
          name: 'context-view',
          component: ContextDetailView,
          props: true,
        },
        {
          path: 'resources',
          name: 'resources',
          component: ResourcesView,
        },
        {
          path: 'resources/:id',
          name: 'portal-view',
          component: PortalDetailView,
          props: true,
        },
        {
          path: 'spaces',
          name: 'spaces',
          component: SpacesView,
        },
        {
          path: 'spaces/new',
          name: 'space-new',
          component: SpaceDetailView,
        },
        {
          path: 'spaces/:id',
          name: 'space-view',
          component: SpaceDetailView,
          props: true,
        },
        {
          path: 'extensions',
          name: 'extensions',
          component: ExtensionListView,
        },
        {
          path: 'extensions/new',
          name: 'extension-new',
          component: ExtensionDetailView,
        },
        {
          path: 'extensions/:id',
          name: 'extension-view',
          component: ExtensionDetailView,
          props: true,
        },
      ],
    },
  ],
})

export default router

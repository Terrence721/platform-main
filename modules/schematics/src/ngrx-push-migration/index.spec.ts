import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { createWorkspace } from '@ngrx/schematics-core/testing';

describe('NgrxPush migration', () => {
  const schematicRunner = new SchematicTestRunner(
    '@ngrx/schematics',
    path.join(process.cwd(), 'dist/modules/schematics/collection.json')
  );

  let appTree: UnitTestTree;

  beforeEach(async () => {
    appTree = await createWorkspace(schematicRunner, appTree);
  });

  describe('migrateToNgrxPush', () => {
    const TEMPLATE = `
    <span>promise|async</span> <!-- this will also get replaced -->
    <span>One whitespace {{ greeting | async }}</span>
    <span>No whitespace {{ greeting |async }}</span>
    <span>Multiple whitespace {{ greeting |      async }}</span>
  `;

    it('should replace an inline template', async () => {
      appTree.create(
        './sut.component.ts',
        `@Component({
        selector: 'sut',
        template: \`${TEMPLATE}\`
      })
      export class SUTComponent { }`
      );

      const tree = await schematicRunner.runSchematic(
        'ngrx-push-migration',
        {},
        appTree
      );

      const actual = tree.readContent('./sut.component.ts');
      expect(actual).not.toContain('async');
      expect(actual).toContain('ngrxPush');
    });

    it('should replace a file template', async () => {
      appTree.create(
        './sut.component.ts',
        `@Component({
        selector: 'sut',
        templateUrl: './sut.component.html'
      })
      export class SUTComponent { }`
      );
      appTree.create('./sut.component.html', TEMPLATE);

      const tree = await schematicRunner.runSchematic(
        'ngrx-push-migration',
        {},
        appTree
      );

      const actual = tree.readContent('./sut.component.html');
      expect(actual).not.toContain('async');
      expect(actual).toContain('ngrxPush');
    });

    it('should not touch templates that are not referenced', async () => {
      appTree.create('./sut.component.html', TEMPLATE);

      const tree = await schematicRunner.runSchematic(
        'ngrx-push-migration',
        {},
        appTree
      );

      const actual = tree.readContent('./sut.component.html');
      expect(actual).toBe(TEMPLATE);
    });
  });

  describe('importPushModule', () => {
    it('should import PushPipe when BrowserModule is imported', async () => {
      appTree.create(
        './sut.module.ts',
        `
          import { BrowserModule } from '@angular/platform-browser';
          import { NgModule } from '@angular/core';

          import { AppComponent } from './app.component';

          @NgModule({
            declarations: [ AppComponent ],
            imports: [ BrowserModule ],
            providers: [],
            bootstrap: [AppComponent]
          })
          export class AppModule { }
      `
      );
      const tree = await schematicRunner.runSchematic(
        'ngrx-push-migration',
        {},
        appTree
      );

      const actual = tree.readContent('./sut.module.ts');
      expect(actual).toMatch(/imports: \[ BrowserModule, PushPipe \],/);
      expect(actual).toMatch(/import { PushPipe } from '@ngrx\/component'/);
    });

    it('should import PushPipe when CommonModule is imported', async () => {
      appTree.create(
        './sut.module.ts',
        `
          import { CommonModule } from '@angular/common';
          import { NgModule } from '@angular/core';

          import { AppComponent } from './app.component';

          @NgModule({
            declarations: [ AppComponent ],
            imports: [ CommonModule ],
            providers: [],
            bootstrap: [AppComponent]
          })
          export class AppModule { }
      `
      );
      const tree = await schematicRunner.runSchematic(
        'ngrx-push-migration',
        {},
        appTree
      );

      const actual = tree.readContent('./sut.module.ts');
      expect(actual).toMatch(/imports: \[ CommonModule, PushPipe \],/);
      expect(actual).toMatch(/import { PushPipe } from '@ngrx\/component'/);
    });

    it("should not import PushPipe when it doesn't need to", async () => {
      appTree.create(
        './sut.module.ts',
        `
          import { AppComponent } from './app.component';

          @NgModule({
            declarations: [ AppComponent ],
            imports: [],
            providers: [],
          })
          export class AppModule { }
      `
      );
      const tree = await schematicRunner.runSchematic(
        'ngrx-push-migration',
        {},
        appTree
      );

      const actual = tree.readContent('./sut.module.ts');
      expect(actual).not.toMatch(/imports: \[ CommonModule, PushPipe \],/);
      expect(actual).not.toMatch(/import { PushPipe } from '@ngrx\/component'/);
    });
  });

  describe('exportPushModule', () => {
    it('should export PushPipe when BrowserModule is exported', async () => {
      appTree.create(
        './sut.module.ts',
        `
          import { BrowserModule } from '@angular/platform-browser';
          import { NgModule } from '@angular/core';

          import { AppComponent } from './app.component';

          @NgModule({
            declarations: [ AppComponent ],
            exports: [ BrowserModule ],
            providers: [],
            bootstrap: [AppComponent]
          })
          export class AppModule { }
      `
      );
      const tree = await schematicRunner.runSchematic(
        'ngrx-push-migration',
        {},
        appTree
      );

      const actual = tree.readContent('./sut.module.ts');
      expect(actual).toMatch(/exports: \[ BrowserModule, PushPipe \],/);
      expect(actual).toMatch(/import { PushPipe } from '@ngrx\/component'/);
    });

    it('should export PushPipe when CommonModule is exported', async () => {
      appTree.create(
        './sut.module.ts',
        `
          import { CommonModule } from '@angular/common';
          import { NgModule } from '@angular/core';

          import { AppComponent } from './app.component';

          @NgModule({
            declarations: [ AppComponent ],
            exports: [ CommonModule ],
            providers: [],
            bootstrap: [AppComponent]
          })
          export class AppModule { }
      `
      );
      const tree = await schematicRunner.runSchematic(
        'ngrx-push-migration',
        {},
        appTree
      );

      const actual = tree.readContent('./sut.module.ts');
      expect(actual).toMatch(/exports: \[ CommonModule, PushPipe \],/);
      expect(actual).toMatch(/import { PushPipe } from '@ngrx\/component'/);
    });

    it("should not export PushPipe when it doesn't need to", async () => {
      appTree.create(
        './sut.module.ts',
        `
          import { AppComponent } from './app.component';

          @NgModule({
            declarations: [ AppComponent ],
            exports: [],
            providers: [],
          })
          export class AppModule { }
      `
      );
      const tree = await schematicRunner.runSchematic(
        'ngrx-push-migration',
        {},
        appTree
      );

      const actual = tree.readContent('./sut.module.ts');
      expect(actual).not.toMatch(/exports: \[ CommonModule, PushPipe \],/);
      expect(actual).not.toMatch(/import { PushPipe } from '@ngrx\/component'/);
    });
  });

  describe('templates that are not the async pipe', () => {
    it('should not change a logical OR or a pipe whose name starts with async', async () => {
      appTree.create(
        './sut.component.ts',
        `@Component({
        selector: 'sut',
        template: '{{ a || asyncValue }} {{ d | asyncDate }} {{ x$ |async }}'
      })
      export class SUTComponent { }`
      );

      const tree = await schematicRunner.runSchematic(
        'ngrx-push-migration',
        {},
        appTree
      );

      const actual = tree.readContent('./sut.component.ts');
      expect(actual).toContain('{{ a || asyncValue }}');
      expect(actual).toContain('{{ d | asyncDate }}');
      expect(actual).toContain('{{ x$ |ngrxPush }}');
    });
  });

  describe('importPushPipeInStandaloneComponents', () => {
    const run = (tree: UnitTestTree) =>
      schematicRunner.runSchematic('ngrx-push-migration', {}, tree);

    const standaloneComponent = `import { Component } from '@angular/core';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'sut',
  imports: [AsyncPipe],
  template: '<p>{{ value$ | async }}</p>',
})
export class SUTComponent {}
`;

    it('should import PushPipe in a standalone component with an inline template', async () => {
      appTree.create('./sut.component.ts', standaloneComponent);

      const actual = (await run(appTree)).readContent('./sut.component.ts');
      expect(actual).toContain('imports: [AsyncPipe, PushPipe],');
      expect(actual).toContain("import { PushPipe } from '@ngrx/component';");
      expect(actual).toContain('{{ value$ | ngrxPush }}');
    });

    it('should import PushPipe in a standalone component with a template file', async () => {
      appTree.create(
        './sut.component.ts',
        `import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'sut',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sut.component.html',
})
export class SUTComponent {}
`
      );
      appTree.create('./sut.component.html', '<p>{{ value$ | async }}</p>');

      const actual = (await run(appTree)).readContent('./sut.component.ts');
      expect(actual).toContain('imports: [CommonModule, PushPipe],');
      expect(actual).toContain("import { PushPipe } from '@ngrx/component';");
    });

    it('should not touch a component declared in an NgModule', async () => {
      appTree.create(
        './sut.component.ts',
        `import { Component } from '@angular/core';

@Component({
  selector: 'sut',
  standalone: false,
  template: '<p>{{ value$ | async }}</p>',
})
export class SUTComponent {}
`
      );

      const actual = (await run(appTree)).readContent('./sut.component.ts');
      expect(actual).not.toContain('PushPipe');
      expect(actual).toContain('{{ value$ | ngrxPush }}');
    });

    it('should not add PushPipe twice when the migration runs again', async () => {
      appTree.create('./sut.component.ts', standaloneComponent);

      const twice = await run(await run(appTree));
      const actual = twice.readContent('./sut.component.ts');
      // Once in the import declaration, once in `imports`.
      expect(actual.match(/PushPipe/g)).toHaveLength(2);
    });
  });
});
